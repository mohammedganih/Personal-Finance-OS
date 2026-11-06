import { prisma } from '../lib/prisma';
import { getCardStatements } from '../services/cardStatement.service';
import { calcEMIOutstanding } from '../services/card-emi.service';
import { syncCardEMIProgress } from '../schedule/progress';

// The Credit cards register: per card, the statement due (an entered statement
// not yet paid in full), the statement building now (EMIs + card purchases +
// card bills this cycle), EMIs still to bill, and the limit left.

export interface CardRow {
  id: string; cardName: string; bank: string | null; lastFourDigits: string | null;
  memberId: string | null; bankAccountId: string | null; creditLimit: number;
  /** An entered statement not yet fully paid. */
  statementDue: { amount: number; dueDate: string; month: string; overdue: boolean } | null;
  buildingNow: { amount: number; dueDate: string };
  emiCount: number;
  /** Card EMI instalments not yet billed. */
  emiStillToBill: number;
  /** Limit less the unpaid statement, this cycle's purchases and bills, and EMIs still to bill. */
  available: number;
}
export interface CardRegister {
  totals: { statementDue: number; nextDueDate: string | null; buildingNow: number; available: number };
  cards: CardRow[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function getCardRegister(userId: string): Promise<CardRegister> {
  await syncCardEMIProgress(prisma, userId);
  const [cards, emis] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false } }),
  ]);
  const rows: CardRow[] = [];
  for (const card of cards) {
    const { statements, upcoming } = await getCardStatements(userId, card.id);
    const unpaid = statements.find((s) => s.status !== 'PAID');
    const mine = emis.filter((e) => e.creditCardId === card.id);
    const emiStillToBill = round(mine.reduce((s, e) => s + calcEMIOutstanding(e), 0));
    // This cycle's EMI instalments are already inside "EMIs still to bill", so only purchases and bills add to it.
    const cyclePurchases = round(upcoming.breakdown.expenses.reduce((s, i) => s + i.amount, 0) + upcoming.breakdown.bills.reduce((s, i) => s + i.amount, 0));
    const used = (unpaid?.remaining ?? 0) + cyclePurchases + emiStillToBill;
    rows.push({
      id: card.id, cardName: card.cardName, bank: card.bank, lastFourDigits: card.lastFourDigits,
      memberId: card.memberId, bankAccountId: card.bankAccountId, creditLimit: Number(card.creditLimit),
      statementDue: unpaid ? { amount: unpaid.remaining, dueDate: unpaid.dueDate, month: unpaid.month, overdue: unpaid.overdue } : null,
      buildingNow: { amount: upcoming.estimatedTotal, dueDate: upcoming.dueDate },
      emiCount: mine.length, emiStillToBill,
      available: round(Math.max(0, Number(card.creditLimit) - used)),
    });
  }
  const dues = rows.filter((r) => r.statementDue).map((r) => r.statementDue!.dueDate).sort();
  return {
    totals: {
      statementDue: round(rows.reduce((s, r) => s + (r.statementDue?.amount ?? 0), 0)),
      nextDueDate: dues[0] ?? null,
      buildingNow: round(rows.reduce((s, r) => s + r.buildingNow.amount, 0)),
      available: round(rows.reduce((s, r) => s + r.available, 0)),
    },
    cards: rows,
  };
}
