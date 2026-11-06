import { prisma } from '../lib/prisma';
import { computeInvestmentValue } from '../services/investment.service';
import { calcEMIOutstanding } from '../services/card-emi.service';
import { paidInByInvestment } from '../schedule/paidIn';

/** What the household owns and owes right now. Every net-worth and debt figure in the app comes from here. */
export interface BalanceSheet {
  /** Bank and cash accounts (credit-card accounts are left out: card debt is counted below). */
  bankBalance: number;
  investmentValue: number;
  /** Money lent to people and not yet settled. */
  moneyLent: number;
  totalAssets: number;

  loanDebt: number;
  cardEmiDebt: number;
  /** Saved card statements not yet fully paid (total due minus card-bill payments for that month). */
  cardStatementsDue: number;
  /** Money borrowed from people and not yet settled. */
  moneyBorrowed: number;
  totalDebt: number;

  netWorth: number;
}

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** Pure: unpaid part of each saved statement, given the card-bill payments recorded per card and month. */
export function unpaidStatements(
  statements: { creditCardId: string; month: string; totalDue: unknown }[],
  payments: { entityId: string; month: string; status: string; amount: unknown }[],
): number {
  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.status === 'SKIPPED') continue; // PAID and AUTO both count
    const key = `${p.entityId}|${p.month}`;
    paid.set(key, (paid.get(key) ?? 0) + Number(p.amount));
  }
  return sum(statements, (s) => Math.max(0, Number(s.totalDue) - (paid.get(`${s.creditCardId}|${s.month}`) ?? 0)));
}

export async function getBalanceSheet(userId: string, now = new Date()): Promise<BalanceSheet> {
  const [accounts, investments, p2p, loans, cardEmis, statements, cardPayments, paidIn] = await Promise.all([
    prisma.account.findMany({ where: { userId, type: { not: 'CREDIT_CARD' } }, select: { balance: true } }),
    prisma.investment.findMany({ where: { userId }, include: { collateral: { select: { ownershipPercent: true } } } }),
    prisma.p2PLoan.findMany({ where: { userId, isSettled: false }, select: { type: true, remainingAmount: true } }),
    prisma.loan.findMany({ where: { userId, isActive: true }, select: { remainingBalance: true } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false } }),
    prisma.cardStatement.findMany({ where: { userId }, select: { creditCardId: true, month: true, totalDue: true } }),
    prisma.dueStatus.findMany({ where: { userId, itemType: 'CARD_STATEMENT' }, select: { itemId: true, period: true, status: true, amount: true } })
      .then((rows) => rows.map((r) => ({ entityId: r.itemId, month: r.period, status: r.status, amount: r.amount }))),
    paidInByInvestment(userId, now),
  ]);

  const bankBalance = sum(accounts, (a) => Number(a.balance));
  const investmentValue = sum(investments, (inv) => computeInvestmentValue(inv, now, paidIn.get(inv.id)).currentValue);
  const moneyLent = sum(p2p.filter((p) => p.type === 'LENT'), (p) => Number(p.remainingAmount));
  const loanDebt = sum(loans, (l) => Number(l.remainingBalance));
  const cardEmiDebt = sum(cardEmis, (e) => calcEMIOutstanding(e));
  const cardStatementsDue = unpaidStatements(statements, cardPayments);
  const moneyBorrowed = sum(p2p.filter((p) => p.type === 'BORROWED'), (p) => Number(p.remainingAmount));

  const totalAssets = bankBalance + investmentValue + moneyLent;
  const totalDebt = loanDebt + cardEmiDebt + cardStatementsDue + moneyBorrowed;
  return {
    bankBalance, investmentValue, moneyLent, totalAssets,
    loanDebt, cardEmiDebt, cardStatementsDue, moneyBorrowed, totalDebt,
    netWorth: totalAssets - totalDebt,
  };
}

/** Everything still owed: the same liabilities net worth subtracts. */
export async function getTotalDebt(userId: string): Promise<number> {
  return (await getBalanceSheet(userId)).totalDebt;
}
