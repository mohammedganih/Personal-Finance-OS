import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { assertOwned } from '../lib/ownership';
import { getBalanceSheetItems, totalsOf, type BalanceSheet, type BalanceSheetItems } from '../metrics';
import { currentMonth } from '../schedule/dueItems';

// The Net worth page: what we own less what we owe (from the metrics module),
// how it moved month to month (from month_close), and a balance check-in that
// corrects bank balances with ADJUST entries.

const round = (n: number) => Math.round(n * 100) / 100;

export interface TrendPoint { month: string; netWorth: number; totalDebt: number; approximate: boolean }
export interface ChangeLine { key: 'bank' | 'other' | 'debt'; label: string; then: number; now: number; change: number }
export interface SinceLastClose { month: string; approximate: boolean; netWorthThen: number; change: number; lines: ChangeLine[] }

export interface NetWorthPage {
  sheet: BalanceSheet;
  items: BalanceSheetItems;
  trend: TrendPoint[];
  sinceLastClose: SinceLastClose | null;
}

/**
 * Splits the change since a close into bank money, everything else we own
 * (investments, gold, money lent) and debt. The close keeps bank balances and
 * total debt, so "everything else" is what's left of net worth.
 */
export function changeSince(
  close: { netWorth: number; totalDebt: number; bank: number },
  sheet: Pick<BalanceSheet, 'netWorth' | 'totalDebt' | 'bankBalance'>,
): ChangeLine[] {
  const otherThen = close.netWorth + close.totalDebt - close.bank;
  const otherNow = sheet.netWorth + sheet.totalDebt - sheet.bankBalance;
  const line = (key: ChangeLine['key'], label: string, then: number, now: number) =>
    ({ key, label, then: round(then), now: round(now), change: round(now - then) });
  return [
    line('bank', 'Bank and cash', close.bank, sheet.bankBalance),
    line('other', 'Investments, gold and money lent', otherThen, otherNow),
    line('debt', 'What we owe', close.totalDebt, sheet.totalDebt),
  ];
}

const bankOf = (balances: unknown) =>
  (Array.isArray(balances) ? balances : []).reduce((s: number, b: { balance?: number }) => s + Number(b?.balance ?? 0), 0);

export async function getNetWorthPage(userId: string, now = new Date()): Promise<NetWorthPage> {
  const [items, closes] = await Promise.all([
    getBalanceSheetItems(userId, now),
    prisma.monthClose.findMany({ where: { userId }, orderBy: { month: 'asc' }, select: { month: true, netWorth: true, totalDebt: true, balances: true, approximate: true } }),
  ]);
  const sheet = totalsOf(items);
  // "Since last close" compares with the latest month before this one.
  const month = currentMonth(now);
  const last = [...closes].reverse().find((c) => c.month < month);
  return {
    sheet, items,
    trend: closes.map((c) => ({ month: c.month, netWorth: Number(c.netWorth), totalDebt: Number(c.totalDebt), approximate: c.approximate })),
    sinceLastClose: last ? {
      month: last.month, approximate: last.approximate, netWorthThen: Number(last.netWorth),
      change: round(sheet.netWorth - Number(last.netWorth)),
      lines: changeSince({ netWorth: Number(last.netWorth), totalDebt: Number(last.totalDebt), bank: bankOf(last.balances) }, sheet),
    } : null,
  };
}

export interface CheckInResult { accountId: string; name: string; before: number; after: number; adjustment: number; transactionId: string | null }

/**
 * Today's balances as read off the bank app. Each account that differs gets an
 * ADJUST entry for the gap (not income or spending), and its balance is set.
 */
export async function checkInBalances(
  userId: string,
  balances: { accountId: string; balance: number }[],
  now = new Date(),
): Promise<CheckInResult[]> {
  const ids = balances.map((b) => b.accountId);
  if (new Set(ids).size !== ids.length) throw createError('Each account can only be listed once', 400);
  await assertOwned(userId, { accounts: ids });
  const accounts = await prisma.account.findMany({ where: { userId, id: { in: ids } } });
  if (accounts.some((a) => a.type === 'CREDIT_CARD')) throw createError('Card balances come from statements, not a check-in', 400);

  return prisma.$transaction(async (tx) => {
    const results: CheckInResult[] = [];
    for (const { accountId, balance } of balances) {
      const account = accounts.find((a) => a.id === accountId)!;
      const before = Number(account.balance);
      const adjustment = round(balance - before);
      let transactionId: string | null = null;
      if (adjustment !== 0) {
        const entry = await tx.transaction.create({
          data: {
            userId, accountId, type: adjustment > 0 ? 'INCOME' : 'EXPENSE', amount: Math.abs(adjustment),
            kind: 'ADJUST', sourceType: 'BALANCE_CHECK', description: 'Balance check-in',
            date: now, period: currentMonth(now), memberId: account.memberId,
          },
        });
        transactionId = entry.id;
        await tx.account.update({ where: { id: accountId }, data: { balance } });
      }
      results.push({ accountId, name: account.name, before, after: balance, adjustment, transactionId });
    }
    await tx.userSettings.upsert({ where: { userId }, create: { userId, balancesCheckedAt: now }, update: { balancesCheckedAt: now } });
    return results;
  });
}
