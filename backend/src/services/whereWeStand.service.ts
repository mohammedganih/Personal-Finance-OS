import { prisma } from '../lib/prisma';
import { firstCardEMIDueDate, shiftMonth } from '../lib/cardPaymentSchedule';
import { getBalanceSheet } from '../metrics';
import { currentMonth } from '../schedule/dueItems';
import { calculateEMISplit } from './loan.service';
import { getBuffer, Buffer } from './buffer.service';
import { lastClose } from './monthClose.service';

// Home's "Where we stand": net worth against the last month close, the buffer
// against its target, and the debt left with the month it ends.

export interface WhereWeStand {
  netWorth: number;
  /** Change since the last month close; null before any month is closed. */
  netWorthChange: { amount: number; sinceMonth: string; approximate: boolean } | null;
  buffer: Buffer;
  debt: { total: number; lastEndsMonth: string | null; lastEndsName: string | null };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Pure: months until a balance is repaid at this EMI and rate (null if the EMI never covers the interest). */
export function monthsToRepay(balance: number, emi: number, annualRate: number): number | null {
  let left = balance;
  for (let n = 0; n < 600; n++) {
    if (left <= 0.5) return n;
    const split = calculateEMISplit(left, emi, annualRate);
    if (split.principalPortion <= 0) return null;
    left = split.newBalance;
  }
  return null;
}

/** The month the last loan or card EMI is due to be repaid. */
export async function lastDebtEnds(userId: string, now = new Date()) {
  const month = currentMonth(now);
  const [loans, emis] = await Promise.all([
    prisma.loan.findMany({ where: { userId, isActive: true }, select: { name: true, remainingBalance: true, emi: true, interestRate: true } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false }, include: { creditCard: true } }),
  ]);
  let last: { month: string; name: string } | null = null;
  const consider = (m: string, name: string) => { if (!last || m > last.month) last = { month: m, name }; };
  for (const l of loans) {
    const n = monthsToRepay(Number(l.remainingBalance), Number(l.emi), Number(l.interestRate));
    // This month's EMI is the first of the n still to pay.
    if (n) consider(shiftMonth(month, n - 1), l.name);
  }
  for (const e of emis) {
    const first = firstCardEMIDueDate({ ...e, emisPaid: 0 }, e.creditCard).slice(0, 7);
    consider(shiftMonth(first, e.tenureMonths - 1), e.itemName);
  }
  return last as { month: string; name: string } | null;
}

export async function getWhereWeStand(userId: string): Promise<WhereWeStand> {
  const [sheet, buffer, close, ends] = await Promise.all([getBalanceSheet(userId), getBuffer(userId), lastClose(userId), lastDebtEnds(userId)]);
  return {
    netWorth: sheet.netWorth,
    netWorthChange: close ? { amount: round(sheet.netWorth - Number(close.netWorth)), sinceMonth: close.month, approximate: close.approximate } : null,
    buffer,
    debt: { total: sheet.totalDebt, lastEndsMonth: ends?.month ?? null, lastEndsName: ends?.name ?? null },
  };
}
