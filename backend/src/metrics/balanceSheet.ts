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

/** One line on the balance sheet. */
export interface SheetItem { id: string; name: string; amount: number; detail?: string }

/** The balance sheet line by line; the totals in BalanceSheet are these lines added up. */
export interface BalanceSheetItems {
  bank: SheetItem[];
  investments: SheetItem[];
  /** Gold and gold schemes (also counted in investmentValue). */
  gold: SheetItem[];
  lent: SheetItem[];
  loans: SheetItem[];
  cardEmis: SheetItem[];
  cardStatements: SheetItem[];
  borrowed: SheetItem[];
}

const GOLD_TYPES = new Set(['GOLD', 'GOLD_SCHEME']);

export async function getBalanceSheetItems(userId: string, now = new Date()): Promise<BalanceSheetItems> {
  const [accounts, investments, p2p, loans, cardEmis, statements, cardPayments, paidIn] = await Promise.all([
    prisma.account.findMany({ where: { userId, type: { not: 'CREDIT_CARD' } }, select: { id: true, name: true, balance: true, type: true }, orderBy: { createdAt: 'asc' } }),
    prisma.investment.findMany({ where: { userId }, include: { collateral: { select: { ownershipPercent: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.p2PLoan.findMany({ where: { userId, isSettled: false }, select: { id: true, personName: true, type: true, remainingAmount: true } }),
    prisma.loan.findMany({ where: { userId, isActive: true }, select: { id: true, name: true, lender: true, remainingBalance: true } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false }, include: { creditCard: { select: { cardName: true } } } }),
    prisma.cardStatement.findMany({ where: { userId }, select: { creditCardId: true, month: true, totalDue: true, creditCard: { select: { cardName: true } } } }),
    prisma.dueStatus.findMany({ where: { userId, itemType: 'CARD_STATEMENT' }, select: { itemId: true, period: true, status: true, amount: true } })
      .then((rows) => rows.map((r) => ({ entityId: r.itemId, month: r.period, status: r.status, amount: r.amount }))),
    paidInByInvestment(userId, now),
  ]);

  const holdings = investments.map((inv) => ({
    inv, value: computeInvestmentValue(inv, now, paidIn.get(inv.id)).currentValue,
  }));
  const holding = ({ inv, value }: (typeof holdings)[number]): SheetItem => ({ id: inv.id, name: inv.assetName, amount: value, detail: inv.assetType });
  const statementLines = statements
    .map((s) => ({ s, unpaid: unpaidStatements([s], cardPayments) }))
    .filter(({ unpaid }) => unpaid > 0)
    .map(({ s, unpaid }): SheetItem => ({ id: `${s.creditCardId}|${s.month}`, name: s.creditCard.cardName, amount: unpaid, detail: s.month }));

  return {
    bank: accounts.map((a) => ({ id: a.id, name: a.name, amount: Number(a.balance), detail: a.type })),
    investments: holdings.filter((h) => !GOLD_TYPES.has(h.inv.assetType)).map(holding),
    gold: holdings.filter((h) => GOLD_TYPES.has(h.inv.assetType)).map(holding),
    lent: p2p.filter((p) => p.type === 'LENT').map((p) => ({ id: p.id, name: p.personName, amount: Number(p.remainingAmount) })),
    loans: loans.map((l) => ({ id: l.id, name: l.name, amount: Number(l.remainingBalance), detail: l.lender ?? undefined })),
    cardEmis: cardEmis.map((e) => ({ id: e.id, name: e.itemName, amount: calcEMIOutstanding(e), detail: e.creditCard.cardName })),
    cardStatements: statementLines,
    borrowed: p2p.filter((p) => p.type === 'BORROWED').map((p) => ({ id: p.id, name: p.personName, amount: Number(p.remainingAmount) })),
  };
}

/** Adds up the line items. */
export function totalsOf(items: BalanceSheetItems): BalanceSheet {
  const total = (rows: SheetItem[]) => sum(rows, (r) => r.amount);
  const bankBalance = total(items.bank);
  const investmentValue = total(items.investments) + total(items.gold);
  const moneyLent = total(items.lent);
  const loanDebt = total(items.loans);
  const cardEmiDebt = total(items.cardEmis);
  const cardStatementsDue = total(items.cardStatements);
  const moneyBorrowed = total(items.borrowed);
  const totalAssets = bankBalance + investmentValue + moneyLent;
  const totalDebt = loanDebt + cardEmiDebt + cardStatementsDue + moneyBorrowed;
  return {
    bankBalance, investmentValue, moneyLent, totalAssets,
    loanDebt, cardEmiDebt, cardStatementsDue, moneyBorrowed, totalDebt,
    netWorth: totalAssets - totalDebt,
  };
}

export async function getBalanceSheet(userId: string, now = new Date()): Promise<BalanceSheet> {
  return totalsOf(await getBalanceSheetItems(userId, now));
}

/** Everything still owed: the same liabilities net worth subtracts. */
export async function getTotalDebt(userId: string): Promise<number> {
  return (await getBalanceSheet(userId)).totalDebt;
}
