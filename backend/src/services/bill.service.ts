import { BillFrequency, RecurringBill } from '@prisma/client';
import { monthOf } from '../lib/ledger';
import { prisma } from '../lib/prisma';
import { assertOwnMembers, attachSplit, copySplitToTransactions, fetchSplits, saveSplit } from '../lib/ownershipSplit';
import { assertOwned } from '../lib/ownership';
import { createError } from '../middleware/error.middleware';
import { categoryIdFor, findCategory } from '../lib/paymentCategory';
import {
  BILL_INCLUDE, BillWithRelations, EMPTY_EVENTS, EventMap, 
  billOccurrencesInRange, billStatusKey, billStatusWhere, buildEventMaps, findBillStatus, loadBillsWithEvents, loadOccurrenceRows, projectAll, toOccurrenceRow, toSchedule,
} from '../schedule/bills';
import {

  diffDays,
  effectiveStatus,
  monthlyEquivalent,
  nextDueDate,
  occurrencesBetween,
  parseDateOnly,
  startOfDay,
} from '../lib/billSchedule';
import {
  BulkBillActionInput,
  CreateBillInput,
  PauseBillInput,
  PayBillOccurrenceInput,
  SkipBillOccurrenceInput,
  UpdateBillInput,
} from '../validators/bill.validator';

// ─── Loading & serialization ─────────────────────────────────────────────────

function serializeBill(bill: BillWithRelations, events: EventMap, today: Date) {
  const schedule = toSchedule(bill);
  const next = nextDueDate(schedule, events, today);
  let lastPaidDate: Date | null = null;
  for (const event of events.values()) {
    if (event.status !== 'PAID' || !event.paidDate) continue;
    if (!lastPaidDate || event.paidDate > lastPaidDate) lastPaidDate = event.paidDate;
  }
  return {
    ...bill,
    amount: Number(bill.amount),
    monthlyEquivalent: monthlyEquivalent(bill.frequency, Number(bill.amount), bill.customIntervalDays),
    effectiveStatus: effectiveStatus(bill, today),
    nextDueDate: next,
    dueInDays: next ? diffDays(startOfDay(today), next) : null,
    lastPaidDate,
  };
}

async function getOwnedBill(userId: string, id: string) {
  const bill = await prisma.recurringBill.findFirst({ where: { id, userId }, include: BILL_INCLUDE });
  if (!bill) throw createError('Bill not found', 404);
  return bill;
}

/** Linked entities must belong to the same user -- never trust raw ids. */
async function assertLinkedOwnership(
  userId: string,
  input: { accountId?: string | null; creditCardId?: string | null; memberId?: string | null }
) {
  await assertOwned(userId, { accounts: [input.accountId], creditCards: [input.creditCardId], members: [input.memberId] });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export interface BillFilters {
  status?: string;
  category?: string;
  frequency?: string;
  search?: string;
}

export async function getBills(userId: string, filters: BillFilters = {}) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = new Date();

  const search = filters.search?.trim().toLowerCase();
  const serialized = bills
    .map((bill) => serializeBill(bill, eventsByBill.get(bill.id) ?? EMPTY_EVENTS, today))
    .filter((bill) => {
      // "ARCHIVED" must be asked for explicitly; every other view hides it.
      if (filters.status) {
        if (bill.effectiveStatus !== filters.status) return false;
      } else if (bill.effectiveStatus === 'ARCHIVED') {
        return false;
      }
      if (filters.category && bill.category !== filters.category) return false;
      if (filters.frequency && bill.frequency !== filters.frequency) return false;
      if (search) {
        const haystack = [bill.name, bill.vendor, bill.category, bill.notes, bill.paymentMethod, ...bill.tags]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

  // Soonest due first; bills with nothing scheduled (ended / paused forever) sink.
  serialized.sort((a, b) => {
    if (a.nextDueDate && b.nextDueDate) return a.nextDueDate.getTime() - b.nextDueDate.getTime();
    if (a.nextDueDate) return -1;
    if (b.nextDueDate) return 1;
    return a.name.localeCompare(b.name);
  });
  const splits = await fetchSplits('BILL', serialized.map((b) => b.id));
  return serialized.map((b) => attachSplit(b, splits.get(b.id)));
}

export async function getBill(userId: string, id: string) {
  const bill = await getOwnedBill(userId, id);
  const occurrences = (await loadOccurrenceRows(userId, { billIds: [id] })).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  const events = buildEventMaps(occurrences).get(id) ?? EMPTY_EVENTS;
  const splits = await fetchSplits('BILL', [id]);
  return {
    ...attachSplit(serializeBill(bill, events, new Date()), splits.get(id)),
    history: occurrences.map((o) => ({
      id: o.id,
      dueDate: o.dueDate,
      status: o.status,
      amount: o.amount != null ? Number(o.amount) : null,
      paidDate: o.paidDate,
      transactionId: o.transactionId,
      notes: o.notes,
    })),
  };
}

function billDataFromInput(input: CreateBillInput) {
  return {
    name: input.name,
    vendor: input.vendor || null,
    category: input.category || 'Other',
    icon: input.icon || null,
    color: input.color || null,
    amount: input.amount,
    currency: input.currency ?? 'INR',
    frequency: input.frequency,
    customIntervalDays: input.frequency === 'CUSTOM' ? input.customIntervalDays ?? null : null,
    startDate: parseDateOnly(input.startDate),
    endDate: input.endDate ? parseDateOnly(input.endDate) : null,
    reminderDays: input.reminderDays,
    autoDebit: input.autoDebit,
    paymentMethod: input.paymentMethod || null,
    accountId: input.accountId || null,
    creditCardId: input.creditCardId || null,
    memberId: input.memberId || null,
    url: input.url || null,
    notes: input.notes || null,
    tags: input.tags ?? [],
  };
}

export async function createBill(userId: string, input: CreateBillInput) {
  await assertLinkedOwnership(userId, input);
  await assertOwnMembers(userId, [input.splitMemberId]);
  const bill = await prisma.recurringBill.create({
    data: { userId, ...billDataFromInput(input), categoryId: await categoryIdFor(userId, input.category || 'Other') },
    include: BILL_INCLUDE,
  });
  await saveSplit(userId, 'BILL', bill.id, input);
  return attachSplit(serializeBill(bill, EMPTY_EVENTS, new Date()), (await fetchSplits('BILL', [bill.id])).get(bill.id));
}

export async function updateBill(userId: string, id: string, input: UpdateBillInput) {
  const existing = await getOwnedBill(userId, id);
  await assertLinkedOwnership(userId, input);
  await assertOwnMembers(userId, [input.splitMemberId]);
  await saveSplit(userId, 'BILL', id, input);

  // CUSTOM interval must never survive a switch to a fixed frequency.
  const frequency = input.frequency ?? existing.frequency;
  const customIntervalDays =
    frequency === 'CUSTOM'
      ? input.customIntervalDays ?? existing.customIntervalDays
      : null;

  const bill = await prisma.recurringBill.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.vendor !== undefined && { vendor: input.vendor || null }),
      ...(input.category !== undefined && { category: input.category || 'Other', categoryId: await categoryIdFor(userId, input.category || 'Other') }),
      ...(input.icon !== undefined && { icon: input.icon || null }),
      ...(input.color !== undefined && { color: input.color || null }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      customIntervalDays,
      ...(input.startDate !== undefined && { startDate: parseDateOnly(input.startDate) }),
      ...(input.endDate !== undefined && { endDate: input.endDate ? parseDateOnly(input.endDate) : null }),
      ...(input.reminderDays !== undefined && { reminderDays: input.reminderDays }),
      ...(input.autoDebit !== undefined && { autoDebit: input.autoDebit }),
      ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod || null }),
      ...(input.accountId !== undefined && { accountId: input.accountId || null }),
      ...(input.creditCardId !== undefined && { creditCardId: input.creditCardId || null }),
      ...(input.memberId !== undefined && { memberId: input.memberId || null }),
      ...(input.url !== undefined && { url: input.url || null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.status !== undefined && {
        status: input.status,
        ...(input.status !== 'PAUSED' && { pausedUntil: null }),
      }),
    },
    include: BILL_INCLUDE,
  });
  return getBill(userId, bill.id);
}

export async function deleteBill(userId: string, id: string) {
  await getOwnedBill(userId, id);
  await prisma.recurringBill.delete({ where: { id } }); // occurrences cascade
}

export async function duplicateBill(userId: string, id: string) {
  const source = await getOwnedBill(userId, id);
  const bill = await prisma.recurringBill.create({
    data: {
      userId,
      name: `${source.name} (Copy)`,
      vendor: source.vendor,
      category: source.category,
      categoryId: source.categoryId,
      icon: source.icon,
      color: source.color,
      amount: source.amount,
      currency: source.currency,
      frequency: source.frequency,
      customIntervalDays: source.customIntervalDays,
      startDate: source.startDate,
      endDate: source.endDate,
      reminderDays: source.reminderDays,
      autoDebit: source.autoDebit,
      paymentMethod: source.paymentMethod,
      accountId: source.accountId,
      creditCardId: source.creditCardId,
      memberId: source.memberId,
      url: source.url,
      notes: source.notes,
      tags: source.tags,
    },
    include: BILL_INCLUDE,
  });
  return serializeBill(bill, EMPTY_EVENTS, new Date());
}

export async function pauseBill(userId: string, id: string, input: PauseBillInput) {
  await getOwnedBill(userId, id);
  const bill = await prisma.recurringBill.update({
    where: { id },
    data: { status: 'PAUSED', pausedUntil: input.pausedUntil ? parseDateOnly(input.pausedUntil) : null },
    include: BILL_INCLUDE,
  });
  return serializeBill(bill, EMPTY_EVENTS, new Date());
}

export async function resumeBill(userId: string, id: string) {
  await getOwnedBill(userId, id);
  const bill = await prisma.recurringBill.update({
    where: { id },
    data: { status: 'ACTIVE', pausedUntil: null },
    include: BILL_INCLUDE,
  });
  return serializeBill(bill, EMPTY_EVENTS, new Date());
}

// ─── Occurrence actions (pay / skip / undo) ──────────────────────────────────

function assertScheduledDate(bill: RecurringBill, dueDate: Date) {
  const scheduled = occurrencesBetween(toSchedule(bill), dueDate, dueDate);
  if (scheduled.length === 0) {
    throw createError('That date is not a scheduled occurrence of this bill', 400);
  }
}

export async function payOccurrence(userId: string, billId: string, input: PayBillOccurrenceInput, options: { auto?: boolean } = {}) {
  const bill = await getOwnedBill(userId, billId);
  const dueDate = parseDateOnly(input.dueDate);
  assertScheduledDate(bill, dueDate);

  const existing = await findBillStatus(prisma, userId, billId, dueDate);
  if (existing?.status === 'PAID') throw createError('This occurrence is already marked as paid', 409); // PAID or AUTO

  const amount = input.amount ?? Number(bill.amount);
  const paidDate = input.paidDate ? parseDateOnly(input.paidDate) : new Date();
  const accountId = input.accountId !== undefined ? input.accountId : bill.accountId;
  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw createError('Linked account not found', 404);
  }

  // Prefer a user category matching the bill's category, then the classic
  // "Subscriptions" bucket the dashboard already understands.
  const categoryId =
    bill.categoryId ?? (await findCategory(userId, bill.category)) ?? (await findCategory(userId, 'Subscriptions'));

  // A bill charged to a credit card is part of that card's bill: ticking it off
  // moves no money. The expense is recorded once, when the card bill is paid.
  const chargedToCard = !!bill.creditCardId && !input.accountId;

  return prisma.$transaction(async (tx) => {
    let transactionId: string | null = existing?.transactionId ?? null;
    if (input.createTransaction && !chargedToCard) {
      const txn = await tx.transaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount,
          description: `Bill: ${bill.name}`,
          kind: 'SPEND',
          sourceType: 'BILL',
          sourceId: bill.id,
          period: monthOf(dueDate),
          date: paidDate,
          categoryId: categoryId ?? undefined,
          accountId: accountId ?? undefined,
          memberId: bill.memberId ?? undefined,
          isRecurring: bill.frequency !== 'ONE_TIME',
        },
      });
      transactionId = txn.id;
      await copySplitToTransactions(tx, userId, 'BILL', billId, [txn.id]);
      if (accountId) {
        await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
      }
    }

    const record = { status: options.auto ? 'AUTO' as const : 'PAID' as const, amount, paidDate, accountId: transactionId ? accountId ?? null : null, transactionIds: transactionId ? [transactionId] : [], notes: input.notes ?? null };
    const row = await tx.dueStatus.upsert({
      where: billStatusWhere(userId, billId, dueDate),
      create: { ...billStatusKey(userId, billId, dueDate), dueDate, ...record },
      update: record,
    });
    const occurrence = toOccurrenceRow(row);
    return { ...occurrence, amount: Number(occurrence.amount) };
  });
}

export async function skipOccurrence(userId: string, billId: string, input: SkipBillOccurrenceInput) {
  const bill = await getOwnedBill(userId, billId);
  const dueDate = parseDateOnly(input.dueDate);
  assertScheduledDate(bill, dueDate);

  const existing = await findBillStatus(prisma, userId, billId, dueDate);
  if (existing?.status === 'PAID') {
    throw createError('This occurrence is already paid — undo the payment first', 409);
  }

  const row = await prisma.dueStatus.upsert({
    where: billStatusWhere(userId, billId, dueDate),
    create: { ...billStatusKey(userId, billId, dueDate), dueDate, status: 'SKIPPED', notes: input.notes ?? null },
    update: { status: 'SKIPPED', notes: input.notes ?? null },
  });
  const occurrence = toOccurrenceRow(row);
  return { ...occurrence, amount: occurrence.amount != null ? Number(occurrence.amount) : null };
}

/**
 * Reverts a paid or skipped occurrence back to pending. For payments this also
 * deletes the auto-created expense transaction and restores the account
 * balance it drew down -- a true undo, not just a status flip.
 */
export async function undoOccurrence(userId: string, billId: string, dueDateInput: string) {
  await getOwnedBill(userId, billId);
  const dueDate = parseDateOnly(dueDateInput);
  const occurrence = await findBillStatus(prisma, userId, billId, dueDate);
  if (!occurrence) throw createError('No paid/skipped record found for this occurrence', 404);

  await prisma.$transaction(async (tx) => {
    if (occurrence.transactionId) {
      const txn = await tx.transaction.findUnique({ where: { id: occurrence.transactionId } });
      if (txn) {
        if (txn.accountId) {
          await tx.account.update({
            where: { id: txn.accountId },
            data: { balance: { increment: Number(txn.amount) } },
          });
        }
        await tx.ownershipSplit.deleteMany({ where: { entityType: 'TRANSACTION', entityId: txn.id } });
        await tx.transaction.delete({ where: { id: txn.id } });
      }
    }
    await tx.dueStatus.delete({ where: { id: occurrence.id } });
  });
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

export async function bulkAction(userId: string, input: BulkBillActionInput) {
  const owned = await prisma.recurringBill.findMany({
    where: { userId, id: { in: input.ids } },
    select: { id: true },
  });
  if (owned.length !== input.ids.length) throw createError('One or more bills not found', 404);
  const where = { userId, id: { in: input.ids } };

  switch (input.action) {
    case 'delete':
      await prisma.recurringBill.deleteMany({ where });
      break;
    case 'archive':
      await prisma.recurringBill.updateMany({ where, data: { status: 'ARCHIVED', pausedUntil: null } });
      break;
    case 'restore':
      await prisma.recurringBill.updateMany({ where, data: { status: 'ACTIVE', pausedUntil: null } });
      break;
    case 'pause':
      await prisma.recurringBill.updateMany({
        where,
        data: { status: 'PAUSED', pausedUntil: input.pausedUntil ? parseDateOnly(input.pausedUntil) : null },
      });
      break;
    case 'resume':
      await prisma.recurringBill.updateMany({ where, data: { status: 'ACTIVE', pausedUntil: null } });
      break;
    case 'setCategory':
      await prisma.recurringBill.updateMany({ where, data: { category: input.category!, categoryId: await categoryIdFor(userId, input.category!) } });
      break;
    case 'setFrequency':
      await prisma.recurringBill.updateMany({
        where,
        data: {
          frequency: input.frequency! as BillFrequency,
          customIntervalDays: input.frequency === 'CUSTOM' ? input.customIntervalDays ?? null : null,
        },
      });
      break;
  }
  return { count: input.ids.length };
}

// ─── Aggregations ────────────────────────────────────────────────────────────

export async function getBillsCalendar(userId: string, startInput?: string, endInput?: string) {
  const today = startOfDay(new Date());
  const start = startInput ? parseDateOnly(startInput) : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = endInput ? parseDateOnly(endInput) : new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return (await billOccurrencesInRange(userId, start, end, today)).map((occ) => ({
    billId: occ.bill.id,
    effectiveBillStatus: occ.effectiveBillStatus,
    accountId: occ.bill.accountId,
    creditCardId: occ.bill.creditCardId,
    memberId: occ.bill.memberId,
    currency: occ.bill.currency,
    name: occ.bill.name,
    vendor: occ.bill.vendor,
    category: occ.bill.category,
    icon: occ.bill.icon,
    color: occ.bill.color,
    autoDebit: occ.bill.autoDebit,
    frequency: occ.bill.frequency,
    dueDate: occ.dueKey,
    status: occ.status,
    amount: occ.amount,
  }));
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export async function getBillReminders(userId: string) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lookahead = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);

  const all = projectAll(bills, eventsByBill, monthStart, lookahead, today);
  return all
    .filter((occ) => {
      if (occ.status === 'OVERDUE') return true;
      if (occ.status === 'DUE_TODAY') return true;
      if (occ.status === 'UPCOMING') {
        return diffDays(today, occ.dueDate) <= occ.bill.reminderDays;
      }
      return false;
    })
    .map((occ) => ({
      billId: occ.bill.id,
      name: occ.bill.name,
      icon: occ.bill.icon,
      category: occ.bill.category,
      amount: occ.amount,
      autoDebit: occ.bill.autoDebit,
      dueDate: occ.dueKey,
      dueInDays: diffDays(today, occ.dueDate),
      kind: occ.status === 'OVERDUE' ? 'overdue' : occ.status === 'DUE_TODAY' ? 'due_today' : 'upcoming',
    }));
}

// ─── Analytics ───────────────────────────────────────────────────────────────

// ─── Smart insights ──────────────────────────────────────────────────────────

export interface BillInsight {
  severity: 'critical' | 'warning' | 'info' | 'positive';
  message: string;
  icon: string;
}

