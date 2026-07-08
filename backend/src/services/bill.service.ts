import { BillFrequency, Prisma, RecurringBill } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { findCategory } from '../lib/paymentCategory';
import {
  BillScheduleShape,
  MaterializedEvent,
  ProjectedStatus,
  diffDays,
  effectiveStatus,
  monthlyEquivalent,
  nextDueDate,
  occurrencesBetween,
  parseDateOnly,
  projectOccurrences,
  startOfDay,
  toDateKey,
} from '../lib/billSchedule';
import {
  BulkBillActionInput,
  CreateBillInput,
  PauseBillInput,
  PayBillOccurrenceInput,
  SkipBillOccurrenceInput,
  UpdateBillInput,
} from '../validators/bill.validator';

const BILL_INCLUDE = {
  member: { select: { id: true, name: true, color: true, emoji: true } },
  account: { select: { id: true, name: true, type: true } },
  creditCard: { select: { id: true, cardName: true, lastFourDigits: true } },
} satisfies Prisma.RecurringBillInclude;

type BillWithRelations = Prisma.RecurringBillGetPayload<{ include: typeof BILL_INCLUDE }>;

type EventMap = Map<string, MaterializedEvent>;

interface OccurrenceRow {
  id: string;
  billId: string;
  dueDate: Date;
  status: 'PAID' | 'SKIPPED';
  amount: Prisma.Decimal | null;
  paidDate: Date | null;
  transactionId: string | null;
  notes: string | null;
}

// ─── Loading & serialization ─────────────────────────────────────────────────

function toSchedule(bill: RecurringBill): BillScheduleShape & { amount: number } {
  return {
    frequency: bill.frequency,
    customIntervalDays: bill.customIntervalDays,
    startDate: bill.startDate,
    endDate: bill.endDate,
    status: bill.status,
    pausedUntil: bill.pausedUntil,
    amount: Number(bill.amount),
  };
}

function buildEventMaps(occurrences: OccurrenceRow[]): Map<string, EventMap> {
  const byBill = new Map<string, EventMap>();
  for (const occ of occurrences) {
    let events = byBill.get(occ.billId);
    if (!events) {
      events = new Map();
      byBill.set(occ.billId, events);
    }
    events.set(toDateKey(occ.dueDate), {
      status: occ.status,
      amount: occ.amount != null ? Number(occ.amount) : null,
      paidDate: occ.paidDate,
    });
  }
  return byBill;
}

const EMPTY_EVENTS: EventMap = new Map();

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

async function loadBillsWithEvents(userId: string) {
  const [bills, occurrences] = await Promise.all([
    prisma.recurringBill.findMany({ where: { userId }, include: BILL_INCLUDE }),
    prisma.billOccurrence.findMany({ where: { userId } }),
  ]);
  return { bills, eventsByBill: buildEventMaps(occurrences as OccurrenceRow[]) };
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
  if (input.accountId) {
    const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
    if (!account) throw createError('Linked account not found', 404);
  }
  if (input.creditCardId) {
    const card = await prisma.creditCard.findFirst({ where: { id: input.creditCardId, userId } });
    if (!card) throw createError('Linked credit card not found', 404);
  }
  if (input.memberId) {
    const member = await prisma.familyMember.findFirst({ where: { id: input.memberId, userId } });
    if (!member) throw createError('Family member not found', 404);
  }
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
  return serialized;
}

export async function getBill(userId: string, id: string) {
  const bill = await getOwnedBill(userId, id);
  const occurrences = (await prisma.billOccurrence.findMany({
    where: { billId: id },
    orderBy: { dueDate: 'desc' },
  })) as OccurrenceRow[];
  const events = buildEventMaps(occurrences).get(id) ?? EMPTY_EVENTS;
  return {
    ...serializeBill(bill, events, new Date()),
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
  const bill = await prisma.recurringBill.create({
    data: { userId, ...billDataFromInput(input) },
    include: BILL_INCLUDE,
  });
  return serializeBill(bill, EMPTY_EVENTS, new Date());
}

export async function updateBill(userId: string, id: string, input: UpdateBillInput) {
  const existing = await getOwnedBill(userId, id);
  await assertLinkedOwnership(userId, input);

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
      ...(input.category !== undefined && { category: input.category || 'Other' }),
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

export async function payOccurrence(userId: string, billId: string, input: PayBillOccurrenceInput) {
  const bill = await getOwnedBill(userId, billId);
  const dueDate = parseDateOnly(input.dueDate);
  assertScheduledDate(bill, dueDate);

  const existing = await prisma.billOccurrence.findUnique({
    where: { billId_dueDate: { billId, dueDate } },
  });
  if (existing?.status === 'PAID') throw createError('This occurrence is already marked as paid', 409);

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
    (await findCategory(userId, bill.category)) ?? (await findCategory(userId, 'Subscriptions'));

  return prisma.$transaction(async (tx) => {
    let transactionId: string | null = existing?.transactionId ?? null;
    if (input.createTransaction) {
      const txn = await tx.transaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount,
          description: `Bill: ${bill.name}`,
          date: paidDate,
          categoryId: categoryId ?? undefined,
          accountId: accountId ?? undefined,
          memberId: bill.memberId ?? undefined,
          isRecurring: bill.frequency !== 'ONE_TIME',
        },
      });
      transactionId = txn.id;
      if (accountId) {
        await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
      }
    }

    const occurrence = await tx.billOccurrence.upsert({
      where: { billId_dueDate: { billId, dueDate } },
      create: {
        billId,
        userId,
        dueDate,
        status: 'PAID',
        amount,
        paidDate,
        transactionId,
        notes: input.notes ?? null,
      },
      update: { status: 'PAID', amount, paidDate, transactionId, notes: input.notes ?? null },
    });
    return { ...occurrence, amount: Number(occurrence.amount) };
  });
}

export async function skipOccurrence(userId: string, billId: string, input: SkipBillOccurrenceInput) {
  const bill = await getOwnedBill(userId, billId);
  const dueDate = parseDateOnly(input.dueDate);
  assertScheduledDate(bill, dueDate);

  const existing = await prisma.billOccurrence.findUnique({
    where: { billId_dueDate: { billId, dueDate } },
  });
  if (existing?.status === 'PAID') {
    throw createError('This occurrence is already paid — undo the payment first', 409);
  }

  const occurrence = await prisma.billOccurrence.upsert({
    where: { billId_dueDate: { billId, dueDate } },
    create: { billId, userId, dueDate, status: 'SKIPPED', notes: input.notes ?? null },
    update: { status: 'SKIPPED', notes: input.notes ?? null },
  });
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
  const occurrence = await prisma.billOccurrence.findFirst({
    where: { billId, userId, dueDate },
  });
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
        await tx.transaction.delete({ where: { id: txn.id } });
      }
    }
    await tx.billOccurrence.delete({ where: { id: occurrence.id } });
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
      await prisma.recurringBill.updateMany({ where, data: { category: input.category! } });
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

// ─── Aggregations: summary / calendar / forecast ─────────────────────────────

interface RangeTotals {
  total: number;
  count: number;
  paid: number;
  paidCount: number;
  overdue: number;
  overdueCount: number;
  dueToday: number;
  dueTodayCount: number;
  upcoming: number;
  upcomingCount: number;
  skipped: number;
  remaining: number;
}

const COUNTED: ProjectedStatus[] = ['PAID', 'OVERDUE', 'DUE_TODAY', 'UPCOMING'];

function bucketTotals(
  occurrences: { status: ProjectedStatus; amount: number }[]
): RangeTotals {
  const t: RangeTotals = {
    total: 0, count: 0, paid: 0, paidCount: 0, overdue: 0, overdueCount: 0,
    dueToday: 0, dueTodayCount: 0, upcoming: 0, upcomingCount: 0, skipped: 0, remaining: 0,
  };
  for (const occ of occurrences) {
    if (occ.status === 'SKIPPED' || occ.status === 'PAUSED') {
      t.skipped += occ.amount;
      continue;
    }
    if (!COUNTED.includes(occ.status)) continue;
    t.total += occ.amount;
    t.count += 1;
    if (occ.status === 'PAID') { t.paid += occ.amount; t.paidCount += 1; }
    if (occ.status === 'OVERDUE') { t.overdue += occ.amount; t.overdueCount += 1; }
    if (occ.status === 'DUE_TODAY') { t.dueToday += occ.amount; t.dueTodayCount += 1; }
    if (occ.status === 'UPCOMING') { t.upcoming += occ.amount; t.upcomingCount += 1; }
  }
  t.remaining = t.total - t.paid;
  return t;
}

interface FlatOccurrence {
  bill: BillWithRelations;
  dueDate: Date;
  dueKey: string;
  status: ProjectedStatus;
  amount: number;
}

function projectAll(
  bills: BillWithRelations[],
  eventsByBill: Map<string, EventMap>,
  rangeStart: Date,
  rangeEnd: Date,
  today: Date
): FlatOccurrence[] {
  const flat: FlatOccurrence[] = [];
  for (const bill of bills) {
    if (bill.status === 'ARCHIVED') continue;
    const projected = projectOccurrences(
      toSchedule(bill),
      eventsByBill.get(bill.id) ?? EMPTY_EVENTS,
      rangeStart,
      rangeEnd,
      today
    );
    for (const occ of projected) flat.push({ bill, ...occ });
  }
  flat.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return flat;
}

export async function getBillsSummary(userId: string) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const activeBills = bills.filter((b) => effectiveStatus(b, today) === 'ACTIVE');
  const pausedBills = bills.filter((b) => effectiveStatus(b, today) === 'PAUSED');

  const monthlyCommitment = activeBills.reduce(
    (s, b) => s + monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays),
    0
  );
  const autoDebitMonthly = activeBills
    .filter((b) => b.autoDebit)
    .reduce((s, b) => s + monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays), 0);

  // One 12-month projection window powers every horizon below.
  const horizonEnd = new Date(today.getFullYear(), today.getMonth() + 12, 0);
  const all = projectAll(bills, eventsByBill, monthStart, horizonEnd, today);

  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  const inRange = (occ: FlatOccurrence, from: Date, to: Date) => occ.dueDate >= from && occ.dueDate <= to;
  const sumWindow = (from: Date, to: Date) =>
    bucketTotals(all.filter((o) => inRange(o, from, to)));

  const thisMonth = sumWindow(monthStart, monthEnd);
  const nextMonth = sumWindow(nextMonthStart, nextMonthEnd);
  const next3Months = sumWindow(monthStart, new Date(today.getFullYear(), today.getMonth() + 3, 0));
  const next6Months = sumWindow(monthStart, new Date(today.getFullYear(), today.getMonth() + 6, 0));
  const next12Months = sumWindow(monthStart, horizonEnd);
  const dueThisWeek = bucketTotals(
    all.filter((o) => inRange(o, today, weekEnd) && o.status !== 'PAID')
  );

  const FREQUENCY_ORDER: BillFrequency[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'EVERY_2_MONTHS', 'QUARTERLY', 'EVERY_4_MONTHS', 'HALF_YEARLY', 'YEARLY', 'CUSTOM', 'ONE_TIME'];
  const byFrequency = FREQUENCY_ORDER
    .map((frequency) => {
      const group = activeBills.filter((b) => b.frequency === frequency);
      return {
        frequency,
        count: group.length,
        amountPerCycle: group.reduce((s, b) => s + Number(b.amount), 0),
        monthlyEquivalent: group.reduce(
          (s, b) => s + monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays),
          0
        ),
      };
    })
    .filter((g) => g.count > 0);

  return {
    monthlyCommitment,
    annualCommitment: monthlyCommitment * 12,
    avgMonthlyNext12: next12Months.total / 12,
    autoDebitMonthly,
    activeCount: activeBills.length,
    pausedCount: pausedBills.length,
    archivedCount: bills.length - activeBills.length - pausedBills.length,
    thisMonth,
    nextMonth,
    next3Months,
    next6Months,
    next12Months,
    dueThisWeek,
    byFrequency,
  };
}

export async function getBillsCalendar(userId: string, startInput?: string, endInput?: string) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const start = startInput
    ? parseDateOnly(startInput)
    : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = endInput
    ? parseDateOnly(endInput)
    : new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const flat = projectAll(bills, eventsByBill, start, end, today);

  // Archived bills stop projecting, but their real (materialized) history in
  // the window should still show on the calendar.
  const archivedIds = new Set(bills.filter((b) => b.status === 'ARCHIVED').map((b) => b.id));
  const archivedEvents: FlatOccurrence[] = [];
  if (archivedIds.size > 0) {
    const billById = new Map(bills.map((b) => [b.id, b]));
    const rows = (await prisma.billOccurrence.findMany({
      where: { userId, billId: { in: [...archivedIds] }, dueDate: { gte: start, lte: end } },
    })) as OccurrenceRow[];
    for (const row of rows) {
      archivedEvents.push({
        bill: billById.get(row.billId)!,
        dueDate: row.dueDate,
        dueKey: toDateKey(row.dueDate),
        status: row.status,
        amount: row.amount != null ? Number(row.amount) : Number(billById.get(row.billId)!.amount),
      });
    }
  }

  return [...flat, ...archivedEvents]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .map((occ) => ({
      billId: occ.bill.id,
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

export async function getBillsForecast(userId: string, months = 12) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const horizonEnd = new Date(today.getFullYear(), today.getMonth() + months, 0);
  const all = projectAll(bills, eventsByBill, monthStart, horizonEnd, today);

  const result = [];
  for (let i = 0; i < months; i++) {
    const from = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const to = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
    const slice = all.filter((o) => o.dueDate >= from && o.dueDate <= to);
    const totals = bucketTotals(slice);

    const byCategory = new Map<string, number>();
    for (const occ of slice) {
      if (occ.status === 'SKIPPED' || occ.status === 'PAUSED') continue;
      byCategory.set(occ.bill.category, (byCategory.get(occ.bill.category) ?? 0) + occ.amount);
    }

    result.push({
      month: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
      label: from.toLocaleString('default', { month: 'short', year: '2-digit' }),
      total: totals.total,
      paid: totals.paid,
      remaining: totals.remaining,
      count: totals.count,
      byCategory: [...byCategory.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    });
  }
  return result;
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

export async function getBillsAnalytics(userId: string) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const activeBills = bills.filter((b) => effectiveStatus(b, today) !== 'ARCHIVED');

  const withMonthly = activeBills.map((b) => ({
    bill: b,
    monthly: monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays),
  }));
  const totalMonthly = withMonthly.reduce((s, x) => s + x.monthly, 0);

  const byCategory = new Map<string, { monthlyEquivalent: number; count: number }>();
  for (const { bill, monthly } of withMonthly) {
    const entry = byCategory.get(bill.category) ?? { monthlyEquivalent: 0, count: 0 };
    entry.monthlyEquivalent += monthly;
    entry.count += 1;
    byCategory.set(bill.category, entry);
  }
  const categoryBreakdown = [...byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      monthlyEquivalent: entry.monthlyEquivalent,
      count: entry.count,
      share: totalMonthly > 0 ? (entry.monthlyEquivalent / totalMonthly) * 100 : 0,
    }))
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  const byVendor = new Map<string, { monthlyEquivalent: number; count: number }>();
  for (const { bill, monthly } of withMonthly) {
    const vendor = bill.vendor || bill.name;
    const entry = byVendor.get(vendor) ?? { monthlyEquivalent: 0, count: 0 };
    entry.monthlyEquivalent += monthly;
    entry.count += 1;
    byVendor.set(vendor, entry);
  }
  const vendorSpend = [...byVendor.entries()]
    .map(([vendor, entry]) => ({ vendor, ...entry }))
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent)
    .slice(0, 10);

  const largestBills = [...withMonthly]
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6)
    .map(({ bill, monthly }) => ({
      id: bill.id,
      name: bill.name,
      category: bill.category,
      icon: bill.icon,
      frequency: bill.frequency,
      amount: Number(bill.amount),
      monthlyEquivalent: monthly,
      share: totalMonthly > 0 ? (monthly / totalMonthly) * 100 : 0,
    }));

  // Trend: 6 months of real payments (occurrence ledger), then 6 months of
  // projection -- the seam between history and forecast is the current month.
  const trend = [];
  const paidRows = (await prisma.billOccurrence.findMany({
    where: {
      userId,
      status: 'PAID',
      dueDate: { gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) },
    },
  })) as OccurrenceRow[];
  const paidByMonth = new Map<string, number>();
  for (const row of paidRows) {
    const d = row.paidDate ?? row.dueDate;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + Number(row.amount ?? 0));
  }
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const horizonEnd = new Date(today.getFullYear(), today.getMonth() + 6, 0);
  const projected = projectAll(bills, eventsByBill, monthStart, horizonEnd, today);
  for (let i = -5; i < 6; i++) {
    const from = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = from.toLocaleString('default', { month: 'short', year: '2-digit' });
    if (i < 0) {
      trend.push({ month: label, paid: paidByMonth.get(`${from.getFullYear()}-${from.getMonth()}`) ?? 0, projected: 0 });
    } else {
      const to = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      const totals = bucketTotals(projected.filter((o) => o.dueDate >= from && o.dueDate <= to));
      trend.push({ month: label, paid: totals.paid, projected: totals.remaining });
    }
  }

  return { categoryBreakdown, vendorSpend, largestBills, trend, totalMonthly };
}

// ─── Smart insights ──────────────────────────────────────────────────────────

export interface BillInsight {
  severity: 'critical' | 'warning' | 'info' | 'positive';
  message: string;
  icon: string;
}

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export async function getBillsInsights(userId: string): Promise<BillInsight[]> {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const today = startOfDay(new Date());
  const insights: BillInsight[] = [];

  const activeBills = bills.filter((b) => effectiveStatus(b, today) === 'ACTIVE');
  if (activeBills.length === 0) return insights;

  const withMonthly = activeBills.map((b) => ({
    bill: b,
    monthly: monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays),
  }));
  const totalMonthly = withMonthly.reduce((s, x) => s + x.monthly, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const horizonEnd = new Date(today.getFullYear(), today.getMonth() + 12, 0);
  const all = projectAll(bills, eventsByBill, monthStart, horizonEnd, today);

  // Overdue first -- most actionable.
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const overdue = all.filter((o) => o.status === 'OVERDUE' && o.dueDate <= monthEnd);
  if (overdue.length > 0) {
    insights.push({
      severity: 'critical',
      icon: '⚠️',
      message: `${overdue.length} bill${overdue.length > 1 ? 's are' : ' is'} overdue, totalling ${formatINR(overdue.reduce((s, o) => s + o.amount, 0))}. Pay or skip them to keep your forecast honest.`,
    });
  }

  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const dueWeek = all.filter(
    (o) => (o.status === 'DUE_TODAY' || o.status === 'UPCOMING') && o.dueDate <= weekEnd
  );
  if (dueWeek.length > 0) {
    insights.push({
      severity: 'warning',
      icon: '📅',
      message: `You have ${dueWeek.length} payment${dueWeek.length > 1 ? 's' : ''} due this week totalling ${formatINR(dueWeek.reduce((s, o) => s + o.amount, 0))}.`,
    });
  }

  // Share of income (avg of last 3 calendar months).
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
  const incomeAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'INCOME', date: { gte: threeMonthsAgo, lte: lastMonthEnd } },
    _sum: { amount: true },
  });
  const avgIncome = Number(incomeAgg._sum.amount ?? 0) / 3;
  if (avgIncome > 0 && totalMonthly > 0) {
    const pct = (totalMonthly / avgIncome) * 100;
    insights.push({
      severity: pct > 40 ? 'critical' : pct > 30 ? 'warning' : 'info',
      icon: '💸',
      message: `Your recurring commitments consume ${pct.toFixed(0)}% of your monthly income.`,
    });
  }

  if (totalMonthly > 0) {
    insights.push({
      severity: 'info',
      icon: '🔄',
      message: `You spend ${formatINR(totalMonthly)} every month on recurring bills — ${formatINR(totalMonthly * 12)} a year.`,
    });
    const byCategory = new Map<string, number>();
    for (const { bill, monthly } of withMonthly) {
      byCategory.set(bill.category, (byCategory.get(bill.category) ?? 0) + monthly);
    }
    const [topCategory, topAmount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      severity: 'info',
      icon: '📊',
      message: `${topCategory} represents ${((topAmount / totalMonthly) * 100).toFixed(0)}% of your recurring bills (${formatINR(topAmount)}/month).`,
    });
  }

  // Heaviest month in the next 12 -- catches insurance/annual-fee pile-ups.
  let peak: { label: string; total: number; top?: string } | null = null;
  for (let i = 0; i < 12; i++) {
    const from = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const to = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
    const slice = all.filter(
      (o) => o.dueDate >= from && o.dueDate <= to && o.status !== 'SKIPPED' && o.status !== 'PAUSED'
    );
    const total = slice.reduce((s, o) => s + o.amount, 0);
    if (!peak || total > peak.total) {
      const catTotals = new Map<string, number>();
      for (const o of slice) catTotals.set(o.bill.category, (catTotals.get(o.bill.category) ?? 0) + o.amount);
      const top = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      peak = { label: from.toLocaleString('default', { month: 'long' }), total, top };
    }
  }
  if (peak && totalMonthly > 0 && peak.total > totalMonthly * 1.4) {
    insights.push({
      severity: 'warning',
      icon: '🏔️',
      message: `${peak.label} is your heaviest month at ${formatINR(peak.total)}${peak.top ? `, driven by ${peak.top}` : ''}. Set money aside early.`,
    });
  }

  // Non-monthly bills landing next month.
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const chunky = all.filter(
    (o) =>
      o.dueDate >= nextMonthStart &&
      o.dueDate <= nextMonthEnd &&
      o.status !== 'SKIPPED' &&
      o.status !== 'PAUSED' &&
      ['QUARTERLY', 'EVERY_4_MONTHS', 'HALF_YEARLY', 'YEARLY'].includes(o.bill.frequency)
  );
  if (chunky.length > 0) {
    insights.push({
      severity: 'info',
      icon: '🧾',
      message: `Quarterly/annual bills next month total ${formatINR(chunky.reduce((s, o) => s + o.amount, 0))} (${chunky.map((o) => o.bill.name).slice(0, 3).join(', ')}${chunky.length > 3 ? '…' : ''}).`,
    });
  }

  // Possible duplicates: same normalized name.
  const nameCounts = new Map<string, number>();
  for (const b of activeBills) {
    const key = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const dupe = activeBills.find(
    (b) => (nameCounts.get(b.name.toLowerCase().replace(/[^a-z0-9]/g, '')) ?? 0) > 1
  );
  if (dupe) {
    insights.push({
      severity: 'warning',
      icon: '👯',
      message: `Possible duplicate: more than one active bill named "${dupe.name}". Merge or archive the extra one.`,
    });
  }

  // Unusually large single commitment.
  if (withMonthly.length >= 3) {
    const sorted = [...withMonthly].sort((a, b) => a.monthly - b.monthly);
    const median = sorted[Math.floor(sorted.length / 2)].monthly;
    const biggest = sorted[sorted.length - 1];
    if (median > 0 && biggest.monthly > median * 3 && biggest.monthly > 1000) {
      insights.push({
        severity: 'info',
        icon: '🐘',
        message: `"${biggest.bill.name}" alone is ${formatINR(biggest.monthly)}/month — ${((biggest.monthly / totalMonthly) * 100).toFixed(0)}% of all recurring spend.`,
      });
    }
  }

  // Annual-plan nudge for monthly software/entertainment subscriptions.
  const annualCandidate = withMonthly
    .filter(
      ({ bill }) =>
        bill.frequency === 'MONTHLY' && ['Software', 'Entertainment'].includes(bill.category)
    )
    .sort((a, b) => b.monthly - a.monthly)[0];
  if (annualCandidate && annualCandidate.monthly >= 300) {
    insights.push({
      severity: 'positive',
      icon: '💡',
      message: `Annual plans for "${annualCandidate.bill.name}" typically cost ~2 months less than paying monthly — a potential ${formatINR(annualCandidate.monthly * 2)}/year saving.`,
    });
  }

  const order = { critical: 0, warning: 1, info: 2, positive: 3 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 8);
}
