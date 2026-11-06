import type { TransactionKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { createError } from '../middleware/error.middleware';
import { fetchSplits } from '../lib/ownershipSplit';

// Spending: the month's money out, bank and card purchases together, day by
// day, with a category breakdown and any per-category limits (budgets).
// By default only everyday spending; `all` also shows transfers, saving, EMIs
// and the card bill.

export interface SpendingEntry {
  id: string;
  /** BANK = a ledger entry; CARD = a card purchase not paid off from the bank. */
  source: 'BANK' | 'CARD';
  date: string; name: string; amount: number;
  /** Ledger kind; card purchases are SPEND (or SAVE when linked to an investment). */
  kind: TransactionKind;
  /** Money in (income, the receiving side of a transfer) when shown with all kinds. */
  incoming: boolean;
  categoryId: string | null; categoryName: string | null; categoryColor: string | null;
  memberId: string | null;
  /** Bank account or card name. */
  from: string | null;
  /** Card purchases: the card, so the page can open it. */
  creditCardId: string | null;
  // Bank entries: what the edit form needs.
  accountId: string | null; notes: string | null; isRecurring: boolean; type: 'INCOME' | 'EXPENSE' | null;
  splitMemberId: string | null; splitRatio: number | null; sourceType: string | null;
}
export interface SpendingCategory { categoryId: string | null; name: string; color: string | null; total: number; limit: number | null; budgetId: string | null }
export interface Spending {
  month: string;
  total: number;
  days: { date: string; total: number; entries: SpendingEntry[] }[];
  categories: SpendingCategory[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function getSpending(userId: string, month: string, all = false): Promise<Spending> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw createError('Invalid month', 400);
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00+05:30`);
  const [txns, cardExpenses, budgets, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId, date: { gte: start, lt: end },
        // Everyday spending by default; the card bill is left out because its purchases are listed one by one.
        ...(all ? {} : { kind: 'SPEND', OR: [{ sourceType: null }, { sourceType: { not: 'CREDIT_CARD' } }] }),
      },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.cardExpense.findMany({
      where: { userId, date: { gte: start, lt: end }, paidDate: null, ...(all ? {} : { linkedType: null }) },
      include: { creditCard: { select: { cardName: true, memberId: true } }, categoryRef: { select: { id: true, name: true, color: true } } },
    }),
    prisma.budget.findMany({ where: { userId }, include: { category: { select: { id: true, name: true, color: true } } } }),
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const splits = await fetchSplits('TRANSACTION', txns.map((t) => t.id));

  const entries: SpendingEntry[] = [
    ...txns.map((t) => {
      const split = splits.get(t.id);
      return {
        id: t.id, source: 'BANK' as const, date: indiaDateKey(t.date), name: t.description || t.category?.name || 'Entry', amount: round(Number(t.amount)),
        kind: t.kind, incoming: t.type === 'INCOME',
        categoryId: t.categoryId, categoryName: t.category?.name ?? null, categoryColor: t.category?.color ?? null,
        memberId: t.memberId, from: t.accountId ? accountName.get(t.accountId) ?? null : null, creditCardId: null,
        accountId: t.accountId, notes: t.notes, isRecurring: t.isRecurring, type: t.type,
        splitMemberId: split?.splitMemberId ?? null, splitRatio: split?.splitRatio ?? null, sourceType: t.sourceType,
      };
    }),
    ...cardExpenses.map((e) => ({
      id: e.id, source: 'CARD' as const, date: indiaDateKey(e.date), name: e.name, amount: round(Number(e.amount)),
      kind: (e.linkedType ? 'SAVE' : 'SPEND') as TransactionKind, incoming: false,
      categoryId: e.categoryId, categoryName: e.categoryRef?.name ?? e.category ?? null, categoryColor: e.categoryRef?.color ?? null,
      memberId: e.memberId ?? e.creditCard.memberId, from: e.creditCard.cardName, creditCardId: e.creditCardId,
      accountId: null, notes: e.notes, isRecurring: false, type: null, splitMemberId: null, splitRatio: null, sourceType: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const spend = entries.filter((e) => e.kind === 'SPEND' && !e.incoming && e.sourceType !== 'CREDIT_CARD');
  const byDay = new Map<string, SpendingEntry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const byCategory = new Map<string, SpendingCategory>();
  for (const e of spend) {
    const key = e.categoryId ?? '';
    const c = byCategory.get(key) ?? { categoryId: e.categoryId, name: e.categoryName ?? 'Uncategorised', color: e.categoryColor, total: 0, limit: null, budgetId: null };
    c.total = round(c.total + e.amount);
    byCategory.set(key, c);
  }
  // Limits show even when nothing has been spent in that category yet.
  for (const b of budgets) {
    const c = byCategory.get(b.categoryId) ?? { categoryId: b.categoryId, name: b.category.name, color: b.category.color, total: 0, limit: null, budgetId: null };
    c.limit = Number(b.monthlyLimit);
    c.budgetId = b.id;
    byCategory.set(b.categoryId, c);
  }

  return {
    month,
    total: round(spend.reduce((s, e) => s + e.amount, 0)),
    days: Array.from(byDay.entries()).map(([date, list]) => ({
      date,
      total: round(list.filter((e) => e.kind === 'SPEND' && !e.incoming && e.sourceType !== 'CREDIT_CARD').reduce((s, e) => s + e.amount, 0)),
      entries: list,
    })),
    categories: Array.from(byCategory.values()).sort((a, b) => b.total - a.total || (b.limit ?? 0) - (a.limit ?? 0)),
  };
}
