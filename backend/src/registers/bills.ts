import { BillFrequency } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { shiftMonth } from '../lib/cardPaymentSchedule';
import { effectiveStatus, monthlyEquivalent, startOfDay } from '../lib/billSchedule';
import { currentMonth, dueItems } from '../schedule/dueItems';
import { toPlanRow, MonthlyPlanRow } from '../services/monthlyPayments.service';

// The Bills & subscriptions register: every bill in one table, with what it
// costs a month, when it is next due, who pays and where it is paid from.
// Bills due every few months show what to set aside each month.

/** Bill categories treated as subscriptions (memberships, streaming, software). */
export const SUBSCRIPTION_CATEGORIES = ['Entertainment', 'Software', 'Fitness'];
/** Frequencies that come round once or twice a year. */
const YEARLY: BillFrequency[] = ['YEARLY', 'HALF_YEARLY'];
/** Frequencies long enough that money should be put aside each month. */
const SET_ASIDE: BillFrequency[] = ['EVERY_2_MONTHS', 'QUARTERLY', 'EVERY_4_MONTHS', 'HALF_YEARLY', 'YEARLY'];
const PER_YEAR: Partial<Record<BillFrequency, number>> = { EVERY_2_MONTHS: 6, QUARTERLY: 4, EVERY_4_MONTHS: 3, HALF_YEARLY: 2, YEARLY: 1 };

export interface BillRow {
  id: string; name: string; vendor: string | null; category: string; frequency: BillFrequency;
  amount: number; monthlyEquivalent: number;
  /** For bills due every 2+ months: what to put aside each month. */
  setAsidePerMonth: number | null;
  status: 'ACTIVE' | 'PAUSED';
  autoDebit: boolean;
  payerMemberId: string | null;
  paidFrom: { kind: 'ACCOUNT' | 'CARD'; id: string; name: string } | null;
  subscription: boolean; utility: boolean; yearly: boolean;
  /** This month's occurrence, or else the next one due. */
  next: (MonthlyPlanRow & { period: string }) | null;
}
export interface BillRegister {
  totals: { monthlyTotal: number; dueThisMonthLeft: number; yearlyCosts: number; yearlySetAside: number };
  bills: BillRow[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function getBillRegister(userId: string, now = new Date()): Promise<BillRegister> {
  const month = currentMonth(now);
  const today = startOfDay(now);
  const [bills, cards, accounts, due] = await Promise.all([
    prisma.recurringBill.findMany({ where: { userId, status: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' } }),
    prisma.creditCard.findMany({ where: { userId }, select: { id: true, cardName: true, memberId: true } }),
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
    dueItems(userId, month, shiftMonth(month, 12), { types: ['BILL'], now }),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const rows: BillRow[] = bills.map((b) => {
    const mine = due.filter((d) => d.itemId === b.id).sort((x, y) => (x.dueDate ?? '').localeCompare(y.dueDate ?? ''));
    const thisMonth = mine.filter((d) => d.period === month);
    const pick = thisMonth.find((d) => d.status === 'PENDING') ?? thisMonth[0] ?? mine.find((d) => d.status === 'PENDING') ?? null;
    const monthly = round(monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays));
    const card = b.creditCardId ? cardById.get(b.creditCardId) : undefined;
    return {
      id: b.id, name: b.name, vendor: b.vendor, category: b.category, frequency: b.frequency,
      amount: Number(b.amount), monthlyEquivalent: monthly,
      setAsidePerMonth: SET_ASIDE.includes(b.frequency) ? monthly : null,
      status: effectiveStatus(b, today) === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
      autoDebit: b.autoDebit,
      payerMemberId: b.memberId ?? card?.memberId ?? null,
      paidFrom: card ? { kind: 'CARD', id: card.id, name: card.cardName }
        : b.accountId ? { kind: 'ACCOUNT', id: b.accountId, name: accountName.get(b.accountId) ?? 'Account' } : null,
      subscription: SUBSCRIPTION_CATEGORIES.includes(b.category),
      utility: b.category === 'Utilities',
      yearly: YEARLY.includes(b.frequency),
      next: pick ? { ...toPlanRow(pick), period: pick.period } : null,
    };
  });

  const active = rows.filter((r) => r.status === 'ACTIVE');
  const yearlyBills = active.filter((r) => r.setAsidePerMonth != null);
  return {
    totals: {
      monthlyTotal: round(active.reduce((s, r) => s + r.monthlyEquivalent, 0)),
      dueThisMonthLeft: round(due.filter((d) => d.period === month && d.status === 'PENDING').reduce((s, d) => s + d.amount, 0)),
      yearlyCosts: round(yearlyBills.reduce((s, r) => s + r.amount * (PER_YEAR[r.frequency] ?? 1), 0)),
      yearlySetAside: round(yearlyBills.reduce((s, r) => s + (r.setAsidePerMonth ?? 0), 0)),
    },
    bills: rows,
  };
}
