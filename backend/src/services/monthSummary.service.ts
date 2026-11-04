import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { currentMonth, getMonthlyPlan, monthWindow, MonthlyPlanRow } from './monthlyPayments.service';

// The home page "month sheet": per person, salary − loans − investments − bills
// = left for the month; minus last month's card spending = free to spend.

export interface SummaryItem {
  id: string; type: string; name: string; amount: number; status: string;
  dueDate: string | null; shared: boolean; memberId: string | null;
}
export interface Bucket { total: number; paid: number; items: SummaryItem[] }
export interface CardSplit {
  creditCardId: string; name: string; memberId: string | null; dueDate: string | null; status: string;
  /** Saved statement balance due this month. */
  statement: number;
  /** Card EMIs and card-charged bills already counted in other buckets. */
  deducted: number;
  /** max(0, statement − deducted): plain spending on the card. */
  spending: number;
  needsStatementUpdate: boolean;
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

const round = (n: number) => Math.round(n * 100) / 100;
const counts = (r: MonthlyPlanRow) => r.status !== 'SKIPPED';

/** Salary for the month, or the most recent earlier month's as an estimate. */
export function pickSalary(records: SalaryRecord[], memberId: string, month: string) {
  const own = records.filter(r => r.memberId === memberId && r.month <= month).sort((a, b) => b.month.localeCompare(a.month));
  if (!own.length) return { salary: 0, salaryIsEstimate: false };
  return { salary: round(own[0].amount), salaryIsEstimate: own[0].month !== month };
}

function bucket(rows: MonthlyPlanRow[]): Bucket {
  const items = rows.map(r => ({
    id: r.id, type: r.type, name: r.name, amount: round(r.amount), status: r.status,
    dueDate: r.dueDate ?? null, shared: !!r.shared, memberId: r.memberId ?? null,
  })).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const live = rows.filter(counts);
  return {
    total: round(live.reduce((s, r) => s + r.amount, 0)),
    paid: round(live.filter(r => r.status === 'PAID').reduce((s, r) => s + r.amount, 0)),
    items,
  };
}

/**
 * Card split for each card whose statement row is in `ownRows`. Deductions are
 * EMIs and bills charged to that card this month, whoever pays them.
 */
export function cardSplits(ownRows: MonthlyPlanRow[], allRows: MonthlyPlanRow[]): CardSplit[] {
  return ownRows.filter(r => r.type === 'CREDIT_CARD').map(st => {
    const cardId = st.creditCardId ?? st.id;
    const deducted = round(allRows
      .filter(r => (r.type === 'CARD_EMI' || r.type === 'BILL') && r.creditCardId === cardId && counts(r))
      .reduce((s, r) => s + r.amount, 0));
    const statement = round(st.amount);
    return {
      creditCardId: cardId, name: st.name.replace(/ - statement balance$/, ''), memberId: st.memberId ?? null,
      dueDate: st.dueDate ?? null, status: st.status,
      statement, deducted, spending: round(Math.max(0, statement - deducted)), needsStatementUpdate: deducted > statement,
    };
  });
}

function totals(rows: MonthlyPlanRow[], allRows: MonthlyPlanRow[], salary: number): Totals {
  const loans = bucket(rows.filter(r => r.type === 'LOAN' || r.type === 'CARD_EMI'));
  const investments = bucket(rows.filter(r => r.type === 'INVESTMENT'));
  const bills = bucket(rows.filter(r => r.type === 'BILL'));
  const cards = cardSplits(rows, allRows);
  const cardSpending = round(cards.reduce((s, c) => s + c.spending, 0));
  const left = round(salary - loans.total - investments.total - bills.total);
  return { salary, loans, investments, bills, cards, cardSpending, left, free: round(left - cardSpending) };
}

/** Pure bucket maths; `getMonthSummary` feeds it from the database. */
export function buildMonthSummary(month: string, rows: MonthlyPlanRow[], members: SummaryMember[], salaries: SalaryRecord[]): MonthSummary {
  const known = new Set(members.map(m => m.id));
  const memberSummaries = members.map(m => {
    const { salary, salaryIsEstimate } = pickSalary(salaries, m.id, month);
    return { memberId: m.id, name: m.name, color: m.color, emoji: m.emoji, salaryIsEstimate, ...totals(rows.filter(r => r.memberId === m.id), rows, salary) };
  });
  // Combined is the whole household, so rows with no person still count here.
  const combined = totals(rows, rows, round(memberSummaries.reduce((s, m) => s + m.salary, 0)));
  const unassigned = rows
    .filter(r => !r.memberId || !known.has(r.memberId))
    .map(r => ({ id: r.id, type: r.type, name: r.name, amount: round(r.amount) }));
  return { month, members: memberSummaries, combined, unassigned };
}

export async function getMonthSummary(userId: string, month = currentMonth()): Promise<MonthSummary> {
  monthWindow(month); // validates the format
  const [plan, members, salaries] = await Promise.all([
    getMonthlyPlan(userId, month),
    prisma.familyMember.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.monthlySalary.findMany({ where: { userId, month: { lte: month } } }),
  ]);
  return buildMonthSummary(month, plan.rows, members, salaries.map(s => ({ memberId: s.memberId, month: s.month, amount: Number(s.amount) })));
}

export async function saveSalary(userId: string, input: { memberId: string; month: string; amount: number; note?: string | null }) {
  const member = await prisma.familyMember.findFirst({ where: { id: input.memberId, userId } });
  if (!member) throw createError('Family member not found', 404);
  const row = await prisma.monthlySalary.upsert({
    where: { userId_memberId_month: { userId, memberId: input.memberId, month: input.month } },
    create: { userId, memberId: input.memberId, month: input.month, amount: input.amount, note: input.note ?? null },
    update: { amount: input.amount, ...(input.note !== undefined ? { note: input.note } : {}) },
  });
  return { ...row, amount: Number(row.amount) };
}
