import { prisma } from '../lib/prisma';
import { indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';

// "Spent so far": everyday spending this month that the month sheet does not
// already count. The sheet already has bills (Bills), the card bill (card
// spending) and card purchases paid off straight away (card spending), so
// those are left out here.

export interface SpentEntry {
  id: string;
  /** TRANSACTION = spent from a bank account; CARD = a card purchase not yet on a statement. */
  source: 'TRANSACTION' | 'CARD';
  name: string;
  date: string;
  amount: number;
  memberId: string | null;
  /** Set when this person pays only a share: the full amount and their %. */
  fullAmount: number | null;
  sharePct: number | null;
}

/** Ledger sources already counted elsewhere on the month sheet. */
const IN_SHEET = ['BILL', 'CREDIT_CARD', 'CARD_EXPENSE'];
const round = (n: number) => Math.round(n * 100) / 100;

/** Pure: splits shared entries into one share per person (`ratio` % stays with the entry's own person). */
export function spentShares(entries: SpentEntry[], splits: Map<string, { secondaryMemberId: string; ratio: number }>): SpentEntry[] {
  return entries.flatMap((e) => {
    const sp = e.source === 'TRANSACTION' ? splits.get(e.id) : undefined;
    if (!sp || !e.memberId || sp.secondaryMemberId === e.memberId) return [e];
    const own = round((e.amount * sp.ratio) / 100);
    return [
      { ...e, amount: own, fullAmount: e.amount, sharePct: sp.ratio },
      { ...e, memberId: sp.secondaryMemberId, amount: round(e.amount - own), fullAmount: e.amount, sharePct: round(100 - sp.ratio) },
    ];
  });
}

/** Everyday spending in `month` not already on the sheet, newest first (whole entries, not yet split). */
export async function getSpentSoFar(userId: string, month: string): Promise<{ entries: SpentEntry[]; splits: Map<string, { secondaryMemberId: string; ratio: number }> }> {
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00+05:30`);
  const [txns, expenses] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, kind: 'SPEND', date: { gte: start, lt: end }, OR: [{ sourceType: null }, { sourceType: { notIn: IN_SHEET } }] },
      select: { id: true, description: true, amount: true, date: true, memberId: true, category: { select: { name: true } } },
    }),
    // Card purchases this month that land on a later statement: not in this month's card spending yet.
    prisma.cardExpense.findMany({
      where: { userId, date: { gte: start, lt: end }, statementMonth: { gt: month }, paidDate: null, linkedType: null },
      include: { creditCard: { select: { cardName: true, memberId: true } } },
    }),
  ]);
  const splitRows = txns.length
    ? await prisma.ownershipSplit.findMany({ where: { userId, entityType: 'TRANSACTION', entityId: { in: txns.map((t) => t.id) } } })
    : [];
  const entries: SpentEntry[] = [
    ...txns.map((t) => ({
      id: t.id, source: 'TRANSACTION' as const, name: t.description || t.category?.name || 'Spending',
      date: indiaDateKey(t.date), amount: round(Number(t.amount)), memberId: t.memberId, fullAmount: null, sharePct: null,
    })),
    ...expenses.map((e) => ({
      id: e.id, source: 'CARD' as const, name: `${e.name} (${e.creditCard.cardName})`,
      date: indiaDateKey(e.date), amount: round(Number(e.amount)), memberId: e.memberId ?? e.creditCard.memberId, fullAmount: null, sharePct: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return { entries, splits: new Map(splitRows.map((s) => [s.entityId, { secondaryMemberId: s.secondaryMemberId, ratio: Number(s.ratio) }])) };
}
