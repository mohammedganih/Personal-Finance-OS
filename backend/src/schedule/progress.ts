import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { dateInMonth, firstCardEMIDueDate, indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';

// Progress comes from the schedule and recorded payments, not from counters
// that only move when someone presses a button. The emisPaid and
// remainingBalance columns are kept as caches, refreshed from here.

type Client = Prisma.TransactionClient | typeof prisma;
type EmiShape = { startDate: Date; tenureMonths: number };
type CardShape = { dueDate: Date; statementDate: Date | null };

const monthDiff = (from: string, to: string) => {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + tm - fm;
};

/** Index (0-based) of the card EMI instalment billed in `month`, or null if none is. */
export function cardEMIInstalmentIndex(emi: EmiShape, card: CardShape, month: string): number | null {
  const k = monthDiff(firstCardEMIDueDate({ ...emi, emisPaid: 0 }, card).slice(0, 7), month);
  return k >= 0 && k < emi.tenureMonths ? k : null;
}

/** Due date of a card EMI instalment in `month` (the card's due day). */
export function cardEMIDueDateIn(card: CardShape, month: string): string {
  return dateInMonth(month, Number(indiaDateKey(card.dueDate).slice(8)));
}

/** Instalments whose due date has passed by `today` (YYYY-MM-DD), capped at the tenure. */
export function billedInstalments(emi: EmiShape, card: CardShape, today: string): number {
  const first = firstCardEMIDueDate({ ...emi, emisPaid: 0 }, card);
  if (today < first) return 0;
  const months = monthDiff(first.slice(0, 7), today.slice(0, 7));
  const dueThisMonth = cardEMIDueDateIn(card, shiftMonth(first.slice(0, 7), months));
  return Math.min(emi.tenureMonths, months + (today >= dueThisMonth ? 1 : 0));
}

/** Refreshes each card EMI's billed count, and archives it once every instalment is billed. */
export async function syncCardEMIProgress(client: Client, userId: string, emiId?: string, now = new Date()) {
  const today = indiaDateKey(now);
  const emis = await client.cardEMI.findMany({ where: { userId, ...(emiId && { id: emiId }) }, include: { creditCard: true } });
  for (const emi of emis) {
    const billed = billedInstalments(emi, emi.creditCard, today);
    const complete = billed >= emi.tenureMonths;
    if (billed !== emi.emisPaid || (complete && !emi.isArchived)) {
      await client.cardEMI.update({ where: { id: emi.id }, data: { emisPaid: billed, ...(complete && { isArchived: true }) } });
    }
  }
}

/** Principal repaid on a loan through recorded EMIs and prepayments. */
export async function recordedPrincipal(client: Client, loanId: string): Promise<number> {
  const [emiPrincipal, prepayments] = await Promise.all([
    client.transaction.aggregate({ where: { sourceType: 'LOAN', sourceId: loanId, description: { startsWith: 'EMI Principal' } }, _sum: { amount: true } }),
    client.loanEvent.aggregate({ where: { loanId, type: 'PREPAYMENT' }, _sum: { amount: true } }),
  ]);
  return Number(emiPrincipal._sum.amount ?? 0) + Number(prepayments._sum.amount ?? 0);
}

/** A loan's balance: the opening balance less the principal repaid through recorded payments. */
export async function loanBalance(client: Client, loan: { id: string; openingBalance: unknown }): Promise<number> {
  return Math.max(0, Math.round((Number(loan.openingBalance) - await recordedPrincipal(client, loan.id)) * 100) / 100);
}

/** Refreshes the loan's remainingBalance cache from its recorded payments; returns the balance. */
export async function syncLoanBalance(client: Client, loanId: string): Promise<number> {
  const loan = await client.loan.findUniqueOrThrow({ where: { id: loanId }, select: { id: true, openingBalance: true, remainingBalance: true } });
  const balance = await loanBalance(client, loan);
  if (balance !== Number(loan.remainingBalance)) await client.loan.update({ where: { id: loanId }, data: { remainingBalance: balance } });
  return balance;
}

/** Opening balance that makes the loan's balance come out at `balance` given what is already recorded. */
export async function openingBalanceFor(client: Client, loanId: string, balance: number): Promise<number> {
  return balance + await recordedPrincipal(client, loanId);
}
