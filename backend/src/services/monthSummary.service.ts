import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { assertOwned } from '../lib/ownership';
import { findCategory } from '../lib/paymentCategory';
import { createError } from '../middleware/error.middleware';
import { currentMonth, getMonthlyPlan, monthWindow, MonthlyPlanRow, SPLIT_ENTITY } from './monthlyPayments.service';
import { CardSpend, getCardSpendForMonth } from './cardStatement.service';

// The home page "month sheet": per person, salary − loans − investments − bills
// = left for the month; minus last month's card spending = free to spend.

export interface SummaryItem {
  id: string; type: string; name: string; amount: number; status: string;
  dueDate: string | null; shared: boolean; memberId: string | null;
  /** Set when this person pays only a share (OwnershipSplit): the full amount and their %. */
  fullAmount: number | null; sharePct: number | null;
  /** Owner of the bank account it is debited from, when that is someone other than the payer. */
  debitedFromMemberId: string | null;
}
export interface Bucket { total: number; paid: number; items: SummaryItem[] }
export interface CardSplit {
  creditCardId: string; name: string; memberId: string | null; dueDate: string | null; status: string;
  /** Saved statement balance due this month. */
  statement: number;
  /** Card EMIs and card-charged bills already counted in other buckets. */
  deducted: number;
  /** Plain spending on the card (see cardSplits). */
  spending: number;
  needsStatementUpdate: boolean;
  /**
   * Where `spending` comes from: STATEMENT = a saved monthly statement;
   * EXPENSES = one-off card purchases entered (no statement saved yet);
   * CARD = the balance typed on the card itself (older entry).
   */
  source: 'STATEMENT' | 'EXPENSES' | 'CARD';
  /** One-off purchases on this statement, purchases already counted elsewhere, and purchases paid off this month. */
  oneOff: number; linked: number; paidOff: number;
}
export interface Totals {
  salary: number; loans: Bucket; investments: Bucket; bills: Bucket;
  cards: CardSplit[]; cardSpending: number; left: number; free: number;
}
export interface MemberSummary extends Totals {
  memberId: string; name: string; color: string | null; emoji: string | null; salaryIsEstimate: boolean;
}
export interface UnassignedRow { id: string; type: string; name: string; amount: number }
export interface MonthSummary { month: string; members: MemberSummary[]; combined: Totals; unassigned: UnassignedRow[] }

export interface SummaryMember { id: string; name: string; color: string | null; emoji: string | null }
export interface SalaryRecord { memberId: string; month: string; amount: number }

export interface SplitRecord { entityType: string; entityId: string; secondaryMemberId: string; ratio: number }
export interface SummaryExtras {
  /** OwnershipSplit rows: `ratio` % stays with the row's own member, the rest goes to secondaryMemberId. */
  splits?: SplitRecord[];
  /** Bank account id → owning member id. */
  accountOwners?: Map<string, string | null>;
  /** One-off card purchases per card for this month's statement (cardStatement.service). */
  cardSpend?: CardSpend[];
}
type SheetRow = MonthlyPlanRow & { fullAmount?: number | null; sharePct?: number | null; debitedFromMemberId?: string | null };


const round = (n: number) => Math.round(n * 100) / 100;
const counts = (r: MonthlyPlanRow) => r.status !== 'SKIPPED';

/**
 * Rows as each person sees them: a split row becomes one share row per person
 * (own member gets `ratio` %, the other person the rest, summing to the full amount).
 */
export function shareRows(rows: SheetRow[], splits: SplitRecord[] = []): SheetRow[] {
  const byEntity = new Map(splits.map(sp => [`${sp.entityType}:${sp.entityId}`, sp]));
  return rows.flatMap(r => {
    const entity = SPLIT_ENTITY[r.type];
    const sp = entity ? byEntity.get(`${entity}:${r.id}`) : undefined;
    if (!sp || !r.memberId || sp.secondaryMemberId === r.memberId) return [r];
    const ratio = Math.min(100, Math.max(0, sp.ratio));
    const own = round(r.amount * ratio / 100);
    const full = round(r.amount);
    return [
      { ...r, amount: own, fullAmount: full, sharePct: ratio },
      { ...r, memberId: sp.secondaryMemberId, amount: round(full - own), fullAmount: full, sharePct: round(100 - ratio) },
    ];
  });
}

/** Salary for the month, or the most recent earlier month's as an estimate. */
export function pickSalary(records: SalaryRecord[], memberId: string, month: string) {
  const own = records.filter(r => r.memberId === memberId && r.month <= month).sort((a, b) => b.month.localeCompare(a.month));
  if (!own.length) return { salary: 0, salaryIsEstimate: false };
  return { salary: round(own[0].amount), salaryIsEstimate: own[0].month !== month };
}

function bucket(rows: SheetRow[]): Bucket {
  const items = rows.map(r => ({
    id: r.id, type: r.type, name: r.name, amount: round(r.amount), status: r.status,
    dueDate: r.dueDate ?? null, shared: !!r.shared, memberId: r.memberId ?? null,
    fullAmount: r.fullAmount ?? null, sharePct: r.sharePct ?? null, debitedFromMemberId: r.debitedFromMemberId ?? null,
  })).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const live = rows.filter(counts);
  return {
    total: round(live.reduce((s, r) => s + r.amount, 0)),
    paid: round(live.filter(r => r.status === 'PAID' || r.status === 'AUTO').reduce((s, r) => s + r.amount, 0)),
    items,
  };
}

/**
 * Card split for each card whose statement row is in `ownRows`, plus cards with
 * only card purchases this month. Deductions are EMIs and bills charged to that
 * card this month (whoever pays them) and card purchases already counted in
 * another bucket.
 * - Saved statement: spending = max(0, statement − deducted).
 * - No saved statement but card purchases entered: spending = those purchases.
 * - Neither: the balance typed on the card, as before.
 * Purchases paid off straight away this month are always added.
 */
export function cardSplits(ownRows: MonthlyPlanRow[], allRows: MonthlyPlanRow[], spend: CardSpend[] = []): CardSplit[] {
  const byCard = new Map(spend.map(s => [s.creditCardId, s]));
  const out: CardSplit[] = ownRows.filter(r => r.type === 'CREDIT_CARD').map(st => {
    const cardId = st.creditCardId ?? st.id;
    const s = byCard.get(cardId);
    byCard.delete(cardId);
    const deducted = round(allRows
      .filter(r => (r.type === 'CARD_EMI' || r.type === 'BILL') && r.creditCardId === cardId && counts(r))
      .reduce((sum, r) => sum + r.amount, 0) + (s?.linked ?? 0));
    const statement = round(st.amount);
    const source: CardSplit['source'] = st.statementId ? 'STATEMENT' : s && (s.oneOff || s.linked) ? 'EXPENSES' : 'CARD';
    const base = source === 'EXPENSES' && s ? s.oneOff : Math.max(0, statement - deducted);
    return {
      creditCardId: cardId, name: st.name.replace(/ - statement balance$/, ''), memberId: st.memberId ?? null,
      dueDate: st.dueDate ?? null, status: st.status,
      statement, deducted, spending: round(base + (s?.paidOff ?? 0)), needsStatementUpdate: source !== 'EXPENSES' && deducted > statement,
      source, oneOff: s?.oneOff ?? 0, linked: s?.linked ?? 0, paidOff: s?.paidOff ?? 0,
    };
  });
  // No statement row yet: the statement building now is this month's EMIs and
  // card bills on the card, plus the card purchases entered for it.
  for (const s of byCard.values()) {
    if (!s.oneOff && !s.paidOff) continue;
    const onCard = allRows.filter(r => (r.type === 'CARD_EMI' || r.type === 'BILL') && r.creditCardId === s.creditCardId && counts(r));
    const deducted = round(onCard.reduce((sum, r) => sum + r.amount, 0) + s.linked);
    const due = onCard.find(r => r.type === 'CARD_EMI')?.dueDate ?? null;
    out.push({
      creditCardId: s.creditCardId, name: s.name, memberId: s.memberId, dueDate: due, status: 'PENDING',
      statement: round(deducted + s.oneOff), deducted, spending: round(s.oneOff + s.paidOff), needsStatementUpdate: false,
      source: 'EXPENSES', oneOff: s.oneOff, linked: s.linked, paidOff: s.paidOff,
    });
  }
  return out;
}

function totals(rows: SheetRow[], allRows: MonthlyPlanRow[], salary: number, spend: CardSpend[] = []): Totals {
  const loans = bucket(rows.filter(r => r.type === 'LOAN' || r.type === 'CARD_EMI'));
  const investments = bucket(rows.filter(r => r.type === 'INVESTMENT'));
  const bills = bucket(rows.filter(r => r.type === 'BILL'));
  const cards = cardSplits(rows, allRows, spend);
  const cardSpending = round(cards.reduce((s, c) => s + c.spending, 0));
  const left = round(salary - loans.total - investments.total - bills.total);
  return { salary, loans, investments, bills, cards, cardSpending, left, free: round(left - cardSpending) };
}

/** Pure bucket maths; `getMonthSummary` feeds it from the database. */
export function buildMonthSummary(month: string, planRows: MonthlyPlanRow[], members: SummaryMember[], salaries: SalaryRecord[], extras: SummaryExtras = {}): MonthSummary {
  const known = new Set(members.map(m => m.id));
  // Note the account owner when it is not the person paying (checked per share for split rows).
  const withDebit = (r: SheetRow): SheetRow => {
    const owner = r.accountId ? extras.accountOwners?.get(r.accountId) : undefined;
    return { ...r, debitedFromMemberId: owner && r.memberId && owner !== r.memberId ? owner : null };
  };
  const rows = planRows.map(withDebit);
  const shares = shareRows(planRows, extras.splits).map(withDebit);
  const memberSummaries = members.map(m => {
    const { salary, salaryIsEstimate } = pickSalary(salaries, m.id, month);
    return { memberId: m.id, name: m.name, color: m.color, emoji: m.emoji, salaryIsEstimate, ...totals(shares.filter(r => r.memberId === m.id), rows, salary, (extras.cardSpend ?? []).filter(c => c.memberId === m.id)) };
  });
  // Combined is the whole household, so rows with no person still count here.
  const combined = totals(rows, rows, round(memberSummaries.reduce((s, m) => s + m.salary, 0)), extras.cardSpend);
  const unassigned = rows
    .filter(r => !r.memberId || !known.has(r.memberId))
    .map(r => ({ id: r.id, type: r.type, name: r.name, amount: round(r.amount) }));
  return { month, members: memberSummaries, combined, unassigned };
}

export async function getMonthSummary(userId: string, month = currentMonth()): Promise<MonthSummary> {
  monthWindow(month); // validates the format
  const [plan, members, salaries, splits, accounts, cardSpend] = await Promise.all([
    getMonthlyPlan(userId, month),
    prisma.familyMember.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.monthlySalary.findMany({ where: { userId, month: { lte: month } } }),
    prisma.ownershipSplit.findMany({ where: { userId, entityType: { in: Array.from(new Set(Object.values(SPLIT_ENTITY))) } } }),
    prisma.account.findMany({ where: { userId }, select: { id: true, memberId: true } }),
    getCardSpendForMonth(userId, month),
  ]);
  return buildMonthSummary(month, plan.rows, members, salaries.map(s => ({ memberId: s.memberId, month: s.month, amount: Number(s.amount) })), {
    splits: splits.map(sp => ({ entityType: sp.entityType, entityId: sp.entityId, secondaryMemberId: sp.secondaryMemberId, ratio: Number(sp.ratio) })),
    accountOwners: new Map(accounts.map(a => [a.id, a.memberId])),
    cardSpend,
  });
}

export interface SaveSalaryInput {
  memberId: string; month: string; amount: number; note?: string | null;
  /** Account the salary landed in. Default: the one saved before, else the person's first savings account. */
  accountId?: string | null;
}

/**
 * Saves a person's salary for a month and keeps its one INCOME ledger entry
 * (sourceType SALARY) in step: created on first save, adjusted when the amount
 * or account changes (the balances move by the difference), removed at 0.
 * A salary already typed by hand for that person and month is adopted rather
 * than counted twice.
 */
export async function saveSalary(userId: string, input: SaveSalaryInput) {
  const member = await prisma.familyMember.findFirst({ where: { id: input.memberId, userId } });
  if (!member) throw createError('Family member not found', 404);
  if (input.accountId) await assertOwned(userId, { accounts: [input.accountId] });
  const salaryCategory = await findCategory(userId, 'Salary', 'INCOME');

  return prisma.$transaction(async (tx) => {
    const before = await tx.monthlySalary.findUnique({ where: { userId_memberId_month: { userId, memberId: input.memberId, month: input.month } } });
    const entry = await findSalaryEntry(tx, userId, input.memberId, input.month, before?.id);
    const accountId = input.accountId !== undefined
      ? input.accountId
      : before?.accountId ?? entry?.accountId ?? (await tx.account.findFirst({ where: { userId, memberId: input.memberId, type: 'SAVINGS', isActive: true }, orderBy: { createdAt: 'asc' } }))?.id ?? null;

    const row = await tx.monthlySalary.upsert({
      where: { userId_memberId_month: { userId, memberId: input.memberId, month: input.month } },
      create: { userId, memberId: input.memberId, month: input.month, amount: input.amount, note: input.note ?? null, accountId },
      update: { amount: input.amount, accountId, ...(input.note !== undefined ? { note: input.note } : {}) },
    });

    // Take the old entry's money back out, then put the new amount in.
    if (entry?.accountId) await tx.account.update({ where: { id: entry.accountId }, data: { balance: { decrement: entry.amount } } });
    let transactionId: string | null = null;
    if (input.amount > 0) {
      const data = { amount: input.amount, accountId, kind: 'INCOME' as const, sourceType: 'SALARY', sourceId: row.id, period: input.month };
      const saved = entry
        ? await tx.transaction.update({ where: { id: entry.id }, data })
        : await tx.transaction.create({ data: {
            ...data, userId, type: 'INCOME', memberId: input.memberId, categoryId: salaryCategory, description: 'Salary',
            date: new Date(`${input.month}-01T12:00:00+05:30`),
          } });
      transactionId = saved.id;
      if (accountId) await tx.account.update({ where: { id: accountId }, data: { balance: { increment: input.amount } } });
    } else if (entry) {
      await tx.transaction.delete({ where: { id: entry.id } });
    }
    return { ...row, amount: Number(row.amount), transactionId };
  });
}

/** The salary's ledger entry, or the one hand-typed Salary income for that person and month. */
async function findSalaryEntry(tx: Prisma.TransactionClient, userId: string, memberId: string, month: string, salaryId?: string) {
  if (salaryId) {
    const linked = await tx.transaction.findFirst({ where: { userId, sourceType: 'SALARY', sourceId: salaryId } });
    if (linked) return linked;
  }
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const end = new Date(`${monthWindow(month).next}-01T00:00:00+05:30`);
  const typed = await tx.transaction.findMany({
    where: { userId, memberId, type: 'INCOME', sourceType: null, transferGroupId: null, category: { name: 'Salary' }, date: { gte: start, lt: end } },
    take: 2,
  });
  return typed.length === 1 ? typed[0] : null;
}
