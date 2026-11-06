import { Prisma, CreditCard, CardExpense, CardEMI } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { dateInMonth, firstCardEMIDueDate, indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { findCategory } from '../lib/paymentCategory';
import { assertOwnMembers } from '../lib/ownershipSplit';
import { getBillsCalendar } from './bill.service';
import type {
  SaveCardStatementInput, CreateCardExpenseInput, UpdateCardExpenseInput, PayCardExpenseInput,
} from '@shazah/shared';

// Monthly card statements and one-off card purchases.
// A statement is keyed by its due month (YYYY-MM). Payments against it are the
// CREDIT_CARD MonthlyPayment record for that month (see credit-card.service).

type Db = Prisma.TransactionClient | typeof prisma;
const round = (n: number) => Math.round(n * 100) / 100;
const asDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(key: string, days: number) {
  const d = asDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + tm - fm;
}

// ── Billing cycle maths (pure) ────────────────────────────────────────────────

export interface CardDays { statementDay: number | null; dueDay: number }
export function cardDays(card: { statementDate: Date | null; dueDate: Date }): CardDays {
  return {
    statementDay: card.statementDate ? Number(indiaDateKey(card.statementDate).slice(8)) : null,
    dueDay: Number(indiaDateKey(card.dueDate).slice(8)),
  };
}

export interface Cycle { month: string; periodStart: string; statementDate: string; dueDate: string }

/** The statement due in `month` (YYYY-MM): its billing period, statement date and due date. */
export function cycleForDueMonth(days: CardDays, month: string): Cycle {
  const sd = days.statementDay ?? days.dueDay;
  // A due day after the statement day falls in the same month; otherwise the next one.
  const statementMonth = days.statementDay != null && days.dueDay > days.statementDay ? month : shiftMonth(month, -1);
  const statementDate = dateInMonth(statementMonth, sd);
  return {
    month,
    periodStart: addDays(dateInMonth(shiftMonth(statementMonth, -1), sd), 1),
    statementDate,
    dueDate: dateInMonth(month, days.dueDay),
  };
}

/** Due month of the statement a purchase on `dateKey` bills on. */
export function dueMonthForDate(days: CardDays, dateKey: string): string {
  const sd = days.statementDay ?? days.dueDay;
  const m = dateKey.slice(0, 7);
  const statementMonth = dateKey <= dateInMonth(m, sd) ? m : shiftMonth(m, 1);
  return days.statementDay != null && days.dueDay > days.statementDay ? statementMonth : shiftMonth(statementMonth, 1);
}

/** True when a card EMI has an instalment on the statement due in `month`. */
export function emiOnStatement(emi: { startDate: Date; tenureMonths: number; emisPaid: number }, card: { dueDate: Date; statementDate: Date | null }, month: string) {
  const first = firstCardEMIDueDate(emi, card).slice(0, 7);
  const index = monthsBetween(first, month);
  return index >= 0 && index < emi.tenureMonths;
}

export type StatementStatus = 'DUE' | 'PART_PAID' | 'PAID';
export function statementStatus(total: number, paid: number): StatementStatus {
  if (paid >= total - 0.005) return 'PAID';
  return paid > 0 ? 'PART_PAID' : 'DUE';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ownCard(userId: string, cardId: string, db: Db = prisma) {
  const card = await db.creditCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw createError('Credit card not found', 404);
  return card;
}

/** Due month for a purchase: a saved statement whose period holds the date wins, else the card's cycle. */
async function resolveStatementMonth(db: Db, card: { id: string; dueDate: Date; statementDate: Date | null }, dateKey: string) {
  const day = asDate(dateKey);
  const saved = await db.cardStatement.findFirst({ where: { creditCardId: card.id, periodStart: { lte: day }, statementDate: { gte: day } } });
  return saved?.month ?? dueMonthForDate(cardDays(card), dateKey);
}

function parsePaidDate(key?: string) {
  if (!key) return new Date();
  const d = new Date(`${key}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000) throw createError('Paid date is not valid', 400);
  return d;
}

/**
 * Keeps the card's own statement fields (outstanding, minimum, due and
 * statement dates) in step with its latest saved statement, so older screens
 * and the debt maths read the real statement. A newer figure typed on the card
 * itself (e.g. next month's estimate) is left alone.
 */
export async function syncCardFromStatements(db: Db, userId: string, cardId: string) {
  const card = await db.creditCard.findFirst({ where: { id: cardId, userId } });
  const latest = await db.cardStatement.findFirst({ where: { creditCardId: cardId, userId }, orderBy: { month: 'desc' } });
  if (!card || !latest || latest.month < indiaDateKey(card.dueDate).slice(0, 7)) return;
  const event = await db.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: { userId, entityType: 'CREDIT_CARD', entityId: cardId, month: latest.month } } });
  const paid = event?.status === 'PAID' ? Number(event.amount) : 0;
  await db.creditCard.update({
    where: { id: cardId },
    data: {
      outstanding: Math.max(0, round(Number(latest.totalDue) - paid)),
      minimumPayment: latest.minimumDue,
      dueDate: latest.dueDate,
      statementDate: latest.statementDate,
    },
  });
}

// ── Statements ────────────────────────────────────────────────────────────────

export interface BreakdownItem { kind: 'EMI' | 'EXPENSE' | 'BILL'; id: string; name: string; amount: number; date: string | null; category?: string | null; linkedType?: string | null }
export interface Breakdown {
  emis: BreakdownItem[]; expenses: BreakdownItem[]; bills: BreakdownItem[];
  /** Card purchases on this cycle that were paid off straight away (not part of the total). */
  paidOff: BreakdownItem[];
  itemsTotal: number;
  /** Statement total minus the listed items: interest, fees, purchases not entered yet... */
  other: number;
}
export interface StatementPayment { transactionId: string; amount: number; date: string; accountId: string | null; accountName: string | null }
export interface StatementView {
  id: string | null; month: string; periodStart: string; statementDate: string; dueDate: string;
  issued: boolean; totalDue: number; minimumDue: number | null; notes: string | null;
  paidAmount: number; remaining: number; status: StatementStatus; overdue: boolean; minimumMet: boolean;
  paidDate: string | null; paidFromAccountId: string | null; paidFromAccountName: string | null;
  payments: StatementPayment[]; breakdown: Breakdown;
}

type CardRow = CreditCard;
type ExpenseRow = CardExpense;
type EmiRow = CardEMI;
type BillRow = { billId: string; name: string; amount: number; dueDate: string; creditCardId: string | null; status: string };

function buildBreakdown(card: CardRow, cycle: Cycle, total: number | null, emis: EmiRow[], expenses: ExpenseRow[], bills: BillRow[]): Breakdown {
  const onCycle = expenses.filter(e => e.statementMonth === cycle.month);
  const toItem = (e: ExpenseRow): BreakdownItem => ({ kind: 'EXPENSE', id: e.id, name: e.name, amount: round(Number(e.amount)), date: indiaDateKey(e.date), category: e.category, linkedType: e.linkedType });
  const b: Breakdown = {
    emis: emis.filter(e => emiOnStatement(e, card, cycle.month)).map(e => ({ kind: 'EMI', id: e.id, name: e.itemName, amount: round(Number(e.emiAmount)), date: null })),
    expenses: onCycle.filter(e => !e.paidDate).sort((a, z) => a.date.getTime() - z.date.getTime()).map(toItem),
    bills: bills.filter(x => x.creditCardId === card.id && x.status !== 'SKIPPED' && x.dueDate >= cycle.periodStart && x.dueDate <= cycle.statementDate)
      .map(x => ({ kind: 'BILL', id: x.billId, name: x.name, amount: round(x.amount), date: x.dueDate })),
    paidOff: onCycle.filter(e => !!e.paidDate).map(toItem),
    itemsTotal: 0, other: 0,
  };
  b.itemsTotal = round([...b.emis, ...b.expenses, ...b.bills].reduce((s, i) => s + i.amount, 0));
  b.other = total == null ? 0 : round(total - b.itemsTotal);
  return b;
}

/**
 * A card's saved statements (newest first), each with its payments and a
 * breakdown, plus the statement building up now (from EMIs, card purchases and
 * card-charged bills; nothing is guessed beyond those).
 */
export async function getCardStatements(userId: string, cardId: string) {
  const card = await ownCard(userId, cardId);
  const days = cardDays(card);
  const today = indiaDateKey(new Date());
  const [saved, events, emis, expenses, accounts] = await Promise.all([
    prisma.cardStatement.findMany({ where: { userId, creditCardId: cardId }, orderBy: { month: 'desc' } }),
    prisma.monthlyPayment.findMany({ where: { userId, entityType: 'CREDIT_CARD', entityId: cardId } }),
    prisma.cardEMI.findMany({ where: { userId, creditCardId: cardId } }),
    prisma.cardExpense.findMany({ where: { userId, creditCardId: cardId } }),
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const accountName = new Map(accounts.map(a => [a.id, a.name]));
  const txIds = events.flatMap(e => e.transactionIds);
  const txns = txIds.length ? await prisma.transaction.findMany({ where: { userId, id: { in: txIds } } }) : [];

  // The open cycle: the statement today's purchases will land on.
  let upcomingMonth = dueMonthForDate(days, today);
  if (saved.some(s => s.month === upcomingMonth)) upcomingMonth = shiftMonth(upcomingMonth, 1);
  const upcoming = cycleForDueMonth(days, upcomingMonth);

  const cycles = saved.map(s => ({ month: s.month, periodStart: indiaDateKey(s.periodStart), statementDate: indiaDateKey(s.statementDate), dueDate: indiaDateKey(s.dueDate) }));
  const from = [upcoming, ...cycles].reduce((m, c) => (c.periodStart < m ? c.periodStart : m), upcoming.periodStart);
  const bills = (await getBillsCalendar(userId, from, upcoming.statementDate)) as BillRow[];

  const statements: StatementView[] = saved.map((s, i) => {
    const cycle = cycles[i];
    const event = events.find(e => e.month === s.month && e.status === 'PAID');
    const payments = (event?.transactionIds ?? []).map(id => txns.find(t => t.id === id)).filter(Boolean).map(t => ({
      transactionId: t!.id, amount: round(Number(t!.amount)), date: indiaDateKey(t!.date), accountId: t!.accountId, accountName: t!.accountId ? accountName.get(t!.accountId) ?? null : null,
    })).sort((a, z) => a.date.localeCompare(z.date));
    const total = round(Number(s.totalDue));
    const paid = event ? round(Number(event.amount)) : 0;
    const last = payments[payments.length - 1];
    const status = statementStatus(total, paid);
    const minimumDue = s.minimumDue != null ? round(Number(s.minimumDue)) : null;
    return {
      id: s.id, ...cycle, issued: true, totalDue: total, minimumDue, notes: s.notes,
      paidAmount: paid, remaining: Math.max(0, round(total - paid)), status,
      overdue: status !== 'PAID' && cycle.dueDate < today, minimumMet: paid >= (minimumDue ?? total) - 0.005,
      paidDate: last?.date ?? null, paidFromAccountId: last?.accountId ?? null, paidFromAccountName: last?.accountName ?? null,
      payments, breakdown: buildBreakdown(card, cycle, total, emis, expenses, bills),
    };
  });

  const upcomingBreakdown = buildBreakdown(card, upcoming, null, emis, expenses, bills);
  return {
    cardId,
    statements,
    upcoming: { ...upcoming, issued: false, estimatedTotal: upcomingBreakdown.itemsTotal, breakdown: upcomingBreakdown },
  };
}

/** Saves the statement for its due month (replacing an earlier entry for that month). */
export async function saveCardStatement(userId: string, cardId: string, input: SaveCardStatementInput) {
  const card = await ownCard(userId, cardId);
  const month = input.dueDate.slice(0, 7);
  const statementDay = Number(input.statementDate.slice(8));
  const periodStart = input.periodStart ?? addDays(dateInMonth(shiftMonth(input.statementDate.slice(0, 7), -1), statementDay), 1);
  const data = {
    periodStart: asDate(periodStart), statementDate: asDate(input.statementDate), dueDate: asDate(input.dueDate),
    totalDue: input.totalDue, minimumDue: input.minimumDue ?? null, notes: input.notes ?? null,
  };
  return prisma.$transaction(async tx => {
    const row = await tx.cardStatement.upsert({
      where: { creditCardId_month: { creditCardId: card.id, month } },
      create: { userId, creditCardId: card.id, month, ...data },
      update: data,
    });
    await syncCardFromStatements(tx, userId, card.id);
    return { ...row, totalDue: Number(row.totalDue), minimumDue: row.minimumDue != null ? Number(row.minimumDue) : null };
  });
}

export async function deleteCardStatement(userId: string, statementId: string) {
  const st = await prisma.cardStatement.findFirst({ where: { id: statementId, userId } });
  if (!st) throw createError('Statement not found', 404);
  const event = await prisma.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: { userId, entityType: 'CREDIT_CARD', entityId: st.creditCardId, month: st.month } } });
  if (event?.status === 'PAID') throw createError('Undo the payments on this statement first', 409);
  await prisma.cardStatement.delete({ where: { id: st.id } });
}

// ── One-off card expenses ─────────────────────────────────────────────────────

function serializeExpense(e: ExpenseRow) {
  return { ...e, amount: Number(e.amount), date: indiaDateKey(e.date), paidDate: e.paidDate ? indiaDateKey(e.paidDate) : null };
}

async function assertLinked(userId: string, type?: string | null, id?: string | null) {
  if (!type || !id) return;
  const where = { id, userId };
  const found = type === 'INVESTMENT' ? await prisma.investment.findFirst({ where })
    : type === 'LOAN' ? await prisma.loan.findFirst({ where })
    : await prisma.recurringBill.findFirst({ where });
  if (!found) throw createError('Linked item not found', 404);
}

export async function getCardExpenses(userId: string, filter: { cardId?: string; month?: string } = {}) {
  const rows = await prisma.cardExpense.findMany({
    where: { userId, ...(filter.cardId && { creditCardId: filter.cardId }), ...(filter.month && { statementMonth: filter.month }) },
    orderBy: { date: 'desc' },
  });
  return rows.map(serializeExpense);
}

export async function createCardExpense(userId: string, input: CreateCardExpenseInput) {
  const card = await ownCard(userId, input.creditCardId);
  await assertOwnMembers(userId, [input.memberId]);
  await assertLinked(userId, input.linkedType, input.linkedId);
  const statementMonth = input.statementMonth ?? await resolveStatementMonth(prisma, card, input.date);
  return prisma.$transaction(async tx => {
    let row = await tx.cardExpense.create({
      data: {
        userId, creditCardId: card.id, memberId: input.memberId ?? null, name: input.name, amount: input.amount,
        date: asDate(input.date), category: input.category ?? 'Other', statementMonth,
        linkedType: input.linkedType ?? null, linkedId: input.linkedId ?? null, notes: input.notes ?? null,
      },
    });
    if (input.payNow) row = await payExpense(tx, userId, row, card, input.payNow);
    return serializeExpense(row);
  });
}

export async function updateCardExpense(userId: string, id: string, input: UpdateCardExpenseInput) {
  const existing = await prisma.cardExpense.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card expense not found', 404);
  if (existing.paidDate && input.amount !== undefined && input.amount !== Number(existing.amount)) throw createError('Undo the payment before changing the amount', 409);
  const card = await ownCard(userId, input.creditCardId ?? existing.creditCardId);
  await assertOwnMembers(userId, [input.memberId]);
  await assertLinked(userId, input.linkedType, input.linkedId);
  const moved = input.date !== undefined || input.creditCardId !== undefined;
  const statementMonth = input.statementMonth ?? (moved ? await resolveStatementMonth(prisma, card, input.date ?? indiaDateKey(existing.date)) : undefined);
  const row = await prisma.cardExpense.update({
    where: { id },
    data: {
      ...(input.creditCardId !== undefined && { creditCardId: card.id }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.date !== undefined && { date: asDate(input.date) }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.memberId !== undefined && { memberId: input.memberId }),
      ...(input.linkedType !== undefined && { linkedType: input.linkedType }),
      ...(input.linkedId !== undefined && { linkedId: input.linkedId }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(statementMonth && { statementMonth }),
    },
  });
  return serializeExpense(row);
}

export async function deleteCardExpense(userId: string, id: string) {
  const existing = await prisma.cardExpense.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card expense not found', 404);
  await prisma.$transaction(async tx => {
    if (existing.paidDate) await reverseExpensePayment(tx, userId, existing);
    await tx.cardExpense.delete({ where: { id } });
  });
}

/**
 * Paid off within the month: records the payment from a bank account (one
 * expense transaction, one bank debit). It then no longer counts towards the
 * statement it would have billed on.
 */
export async function payCardExpense(userId: string, id: string, input: PayCardExpenseInput = {}) {
  const existing = await prisma.cardExpense.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card expense not found', 404);
  const card = await ownCard(userId, existing.creditCardId);
  return prisma.$transaction(async tx => serializeExpense(await payExpense(tx, userId, existing, card, input)));
}

async function payExpense(tx: Prisma.TransactionClient, userId: string, expense: ExpenseRow, card: CardRow, input: PayCardExpenseInput) {
  if (expense.paidDate) throw createError('Already paid', 409);
  const paidOn = parsePaidDate(input.paidDate);
  const accountId = input.accountId || card.bankAccountId || null;
  if (accountId && !await tx.account.findFirst({ where: { id: accountId, userId } })) throw createError('Account not found', 404);
  const categoryId = (await findCategory(userId, expense.category)) ?? (await findCategory(userId, 'Other'));
  const amount = Number(expense.amount);
  const txn = await tx.transaction.create({
    data: {
      userId, type: 'EXPENSE', kind: 'SPEND', sourceType: 'CARD_EXPENSE', sourceId: expense.id, period: expense.statementMonth, amount, date: paidOn, accountId, categoryId,
      description: `Card: ${expense.name} (${card.cardName}${card.lastFourDigits ? ` ···· ${card.lastFourDigits}` : ''})`,
      memberId: expense.memberId ?? card.memberId,
    },
  });
  if (accountId) await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
  return tx.cardExpense.update({ where: { id: expense.id }, data: { paidDate: paidOn, paidFromAccountId: accountId, transactionId: txn.id } });
}

async function reverseExpensePayment(tx: Prisma.TransactionClient, userId: string, expense: ExpenseRow) {
  const txn = expense.transactionId ? await tx.transaction.findFirst({ where: { id: expense.transactionId, userId } }) : null;
  if (txn) {
    if (txn.accountId) await tx.account.update({ where: { id: txn.accountId }, data: { balance: { increment: txn.amount } } });
    await tx.transaction.delete({ where: { id: txn.id } });
  }
  return tx.cardExpense.update({ where: { id: expense.id }, data: { paidDate: null, paidFromAccountId: null, transactionId: null } });
}

export async function undoCardExpensePayment(userId: string, id: string) {
  const existing = await prisma.cardExpense.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card expense not found', 404);
  if (!existing.paidDate) throw createError('This purchase has no payment to undo', 400);
  return prisma.$transaction(async tx => serializeExpense(await reverseExpensePayment(tx, userId, existing)));
}

// ── Home: card spending from real data ────────────────────────────────────────

export interface CardSpend {
  creditCardId: string; name: string; memberId: string | null;
  /** One-off purchases on the statement due this month (not paid off, not linked). */
  oneOff: number;
  /** Purchases on that statement already counted in another bucket (linkedType set). */
  linked: number;
  /** Purchases paid off straight away during this month. */
  paidOff: number;
}

export async function getCardSpendForMonth(userId: string, month: string): Promise<CardSpend[]> {
  if (!isDateKey(`${month}-01`)) throw createError('Invalid month', 400);
  const next = shiftMonth(month, 1);
  const [cards, expenses] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId, isActive: true } }),
    prisma.cardExpense.findMany({ where: { userId, OR: [{ statementMonth: month }, { paidDate: { gte: new Date(`${month}-01T00:00:00+05:30`), lt: new Date(`${next}-01T00:00:00+05:30`) } }] } }),
  ]);
  return cards.map(card => {
    const own = expenses.filter(e => e.creditCardId === card.id);
    const sum = (rows: ExpenseRow[]) => round(rows.reduce((s, e) => s + Number(e.amount), 0));
    const onStatement = own.filter(e => e.statementMonth === month && !e.paidDate);
    return {
      creditCardId: card.id, name: card.cardName, memberId: card.memberId,
      oneOff: sum(onStatement.filter(e => !e.linkedType)),
      linked: sum(onStatement.filter(e => !!e.linkedType)),
      paidOff: sum(own.filter(e => e.paidDate && indiaDateKey(e.paidDate).slice(0, 7) === month)),
    };
  }).filter(s => s.oneOff || s.linked || s.paidOff);
}
