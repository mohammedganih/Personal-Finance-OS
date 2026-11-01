import { prisma } from '../lib/prisma';
import { indiaDateKey } from '../lib/cardPaymentSchedule';
import { currentMonth, getMonthlyPlan, monthWindow } from './monthlyPayments.service';
import { getBillsCalendar } from './bill.service';

export interface FundingPayment {
  id: string; type: string; name: string; amount: number; status: string;
  dueDate?: string; accountId?: string | null;
}
export interface FundingAccount {
  id: string; name: string; bankName?: string | null; type: string; currency?: string;
  balance: unknown; preferredMinimum?: unknown; isActive?: boolean;
  member?: { name: string } | null;
}
const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const sum = (payments: FundingPayment[]) => money(payments.reduce((total, p) => total + p.amount, 0));
export function getAccountTargetBalance(obligations: number, minimum: number) {
  return Math.max(0, obligations, minimum);
}
export function getFundingStatus(current: number, target: number, count: number, urgent: boolean) {
  if (current < target) return urgent ? 'FUND_SOON' : 'SHORT';
  if (!count) return 'NO_UPCOMING_PAYMENTS';
  if (current > target) return 'SURPLUS';
  return 'READY';
}
function validDate(key?: string): key is string {
  return !!key && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(Date.parse(key)) && new Date(key).toISOString().slice(0, 10) === key;
}
export function getUpcomingAccountPayments(payments: FundingPayment[], today: string, end: string) {
  const seen = new Set<string>();
  return payments.filter(p => {
    const key = `${p.type}:${p.id}:${p.dueDate ?? ''}`;
    if (seen.has(key) || p.status !== 'PENDING' || money(p.amount) <= 0 || (p.dueDate !== undefined && !validDate(p.dueDate)) || (p.dueDate && p.dueDate > end)) return false;
    seen.add(key);
    return true;
  }).map(p => ({ ...p, amount: money(p.amount), overdue: !!p.dueDate && p.dueDate < today }))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}
/** End-of-month cash requirement, plus known arrears. Next-seven-day totals
 * cross month boundaries and extend the target horizon when necessary. No future income or automatic transfers assumed. */
export function calculateAccountFunding(accounts: FundingAccount[], payments: FundingPayment[], now: Date, month: string) {
  const today = indiaDateKey(now);
  const monthEnd = monthWindow(month).end;
  const sevenDate = new Date(`${today}T00:00:00Z`);
  sevenDate.setUTCDate(sevenDate.getUTCDate() + 6); // today + six following days
  const sevenEnd = sevenDate.toISOString().slice(0, 10);
  const end = monthEnd > sevenEnd ? monthEnd : sevenEnd;
  const active = accounts.filter(a => a.isActive !== false && ['SAVINGS', 'CHECKING'].includes(a.type) && (!a.currency || a.currency === 'INR'));
  const ids = new Set(active.map(a => a.id));
  const all = getUpcomingAccountPayments(payments, today, end);
  const period = all.filter(p => !p.dueDate || p.dueDate <= end);
  const rows = active.map(a => {
    const linked = all.filter(p => p.accountId === a.id);
    const outstanding = period.filter(p => p.accountId === a.id);
    const currentBalance = money(a.balance); // overdrafts increase the amount to add
    const preferredMinimum = Math.max(0, money(a.preferredMinimum));
    const upcomingObligations = sum(outstanding);
    const targetBalance = getAccountTargetBalance(upcomingObligations, preferredMinimum);
    const dueNext7Days = sum(linked.filter(p => p.dueDate && p.dueDate >= today && p.dueDate <= sevenEnd));
    const overdue = sum(outstanding.filter(p => p.overdue));
    return { id: a.id, name: a.name, bankName: a.bankName, owner: a.member?.name ?? 'Joint / unspecified', currentBalance, preferredMinimum,
      upcomingObligations, targetBalance, amountToAdd: money(Math.max(targetBalance - currentBalance, 0)), surplus: money(Math.max(currentBalance - targetBalance, 0)),
      dueNext7Days, overdue, remainingThisMonth: sum(outstanding.filter(p => p.dueDate?.slice(0, 7) === today.slice(0, 7))),
      status: getFundingStatus(currentBalance, targetBalance, outstanding.length, overdue > 0 || dueNext7Days > 0),
      nextPayment: linked.find(p => p.dueDate) ?? null, payments: outstanding };
  });
  const unassigned = period.filter(p => !p.accountId || !ids.has(p.accountId));
  const totals = { required: money(rows.reduce((s, a) => s + a.targetBalance, 0)), available: money(rows.reduce((s, a) => s + a.currentBalance, 0)),
    toAllocate: money(rows.reduce((s, a) => s + a.amountToAdd, 0)), surplus: money(rows.reduce((s, a) => s + a.surplus, 0)), unassigned: sum(unassigned) };
  const sources = rows.map(a => ({ id: a.id, name: a.name, remaining: a.surplus }));
  const transfers: { fromId: string; from: string; toId: string; to: string; amount: number }[] = [];
  for (const target of [...rows].sort((a, b) => (a.nextPayment?.dueDate ?? '9999').localeCompare(b.nextPayment?.dueDate ?? '9999'))) {
    let short = target.amountToAdd;
    for (const source of sources) {
      const amount = money(Math.min(short, source.remaining));
      if (amount <= 0) continue;
      transfers.push({ fromId: source.id, from: source.name, toId: target.id, to: target.name, amount });
      source.remaining = money(source.remaining - amount); short = money(short - amount);
    }
  }
  return { month, today, end, accounts: rows, totals, unassigned, transfers,
    next7Days: all.filter(p => p.dueDate && p.dueDate >= today && p.dueDate <= sevenEnd).map(p => ({ ...p, accountName: rows.find(a => a.id === p.accountId)?.name ?? 'Account needed' })) };
}

export async function getAccountFundingPlan(userId: string, month = currentMonth()) {
  const window = monthWindow(month);
  const today = indiaDateKey(new Date());
  const seven = new Date(`${today}T00:00:00Z`); seven.setUTCDate(seven.getUTCDate() + 6);
  const horizon = window.end > seven.toISOString().slice(0, 10) ? window.end : seven.toISOString().slice(0, 10);
  const [accounts, plan, next, oldestBill] = await Promise.all([
    prisma.account.findMany({ where: { userId }, include: { member: { select: { name: true } } } }),
    getMonthlyPlan(userId, month), getMonthlyPlan(userId, window.next),
    prisma.recurringBill.findFirst({ where: { userId, status: { not: 'ARCHIVED' } }, orderBy: { startDate: 'asc' }, select: { startDate: true } }),
  ]);
  // Bill occurrence history distinguishes actual unpaid arrears from paid/skipped.
  const bills = await getBillsCalendar(userId, oldestBill ? indiaDateKey(oldestBill.startDate) : window.start, horizon);
  const payments: FundingPayment[] = [...plan.rows, ...next.rows].filter(p => p.type !== 'BILL');
  for (const bill of bills) {
    if (bill.effectiveBillStatus !== 'ACTIVE' || bill.creditCardId || bill.currency !== 'INR' || !['OVERDUE', 'DUE_TODAY', 'UPCOMING'].includes(bill.status)) continue;
    payments.push({ id: bill.billId, type: 'BILL', name: bill.name, amount: bill.amount, status: 'PENDING', dueDate: bill.dueDate, accountId: bill.accountId });
  }
  return calculateAccountFunding(accounts, payments, new Date(), month);
}
