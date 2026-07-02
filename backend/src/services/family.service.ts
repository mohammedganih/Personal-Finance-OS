import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateFamilyMemberInput, UpdateFamilyMemberInput } from '../validators/family.validator';
import { resolveMonthRange } from '../lib/dateRange';

interface SimulatedLoan {
  remainingBalance: number;
  emi: number;
  interestRate: number;
}

/**
 * Simulates paying off a set of loans in a given order (avalanche = highest
 * interest first, snowball = smallest balance first), optionally throwing an
 * extra fixed payment at the front loan each month. Pure function -- no I/O --
 * so the debt-payoff math can be unit tested without a database.
 */
export function simulatePayoff<T extends SimulatedLoan>(order: T[], extraPayment: number) {
  let totalInterest = 0;
  let months = 0;
  const bal = order.map((l) => ({ ...l, balance: l.remainingBalance }));

  while (bal.some((l) => l.balance > 0.01) && months < 600) {
    months++;
    let surplus = extraPayment;
    for (const loan of bal) {
      if (loan.balance <= 0.01) { loan.balance = 0; continue; }
      const interest = loan.balance * (loan.interestRate / 100 / 12);
      totalInterest += interest;
      loan.balance = Math.max(0, loan.balance - Math.max(0, loan.emi - interest));
    }
    for (const loan of bal) {
      if (loan.balance <= 0.01 || surplus <= 0) continue;
      const pay = Math.min(surplus, loan.balance);
      loan.balance -= pay; surplus -= pay;
    }
  }

  return { totalInterest, months };
}

export async function getFamilyMembers(userId: string) {
  return prisma.familyMember.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function createFamilyMember(userId: string, input: CreateFamilyMemberInput) {
  return prisma.familyMember.create({ data: { userId, ...input } });
}

export async function updateFamilyMember(userId: string, id: string, input: UpdateFamilyMemberInput) {
  const existing = await prisma.familyMember.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Family member not found', 404);
  return prisma.familyMember.update({ where: { id }, data: input });
}

export async function deleteFamilyMember(userId: string, id: string) {
  const existing = await prisma.familyMember.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Family member not found', 404);
  await prisma.familyMember.delete({ where: { id } });
}

// ── Contribution helpers ───────────────────────────────────────────────────────

type TxnRow = {
  memberId: string | null;
  splitMemberId: string | null;
  splitRatio: { toNumber(): number } | null;
  type: string;
  amount: { toNumber(): number };
};

type InvRow = {
  memberId: string | null;
  splitMemberId: string | null;
  splitRatio: { toNumber(): number } | null;
  quantity: { toNumber(): number };
  currentPrice: { toNumber(): number };
};

/** Amount of this transaction that belongs to `memberId` */
function txnShare(t: TxnRow, memberId: string): number {
  const amount = Number(t.amount);
  if (!t.memberId) return 0; // unassigned — skip

  if (t.memberId === memberId) {
    const ratio = t.splitMemberId ? (t.splitRatio?.toNumber() ?? 50) / 100 : 1;
    return amount * ratio;
  }
  if (t.splitMemberId === memberId) {
    const ratio = 1 - (t.splitRatio?.toNumber() ?? 50) / 100;
    return amount * ratio;
  }
  return 0;
}

/** Current value of this investment that belongs to `memberId` */
function invShare(inv: InvRow, memberId: string): number {
  const value = Number(inv.quantity) * Number(inv.currentPrice);
  if (!inv.memberId) return 0;

  if (inv.memberId === memberId) {
    const ratio = inv.splitMemberId ? (inv.splitRatio?.toNumber() ?? 50) / 100 : 1;
    return value * ratio;
  }
  if (inv.splitMemberId === memberId) {
    const ratio = 1 - (inv.splitRatio?.toNumber() ?? 50) / 100;
    return value * ratio;
  }
  return 0;
}

// ── Per-member analytics ───────────────────────────────────────────────────────
export async function getMemberAnalytics(userId: string, month?: number, year?: number) {
  const { start: startOfMonth, end: endOfMonth } = resolveMonthRange(month, year);

  const [members, monthlyTxns, allTxns, loans, investments] = await Promise.all([
    prisma.familyMember.findMany({ where: { userId } }),

    prisma.transaction.findMany({
      // Previously only `gte: startOfMonth` with no upper bound -- correct by
      // accident for "this month" (nothing dated in the future), but wrong
      // for any past month, which would silently include every transaction
      // from that month onward through today.
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { memberId: true, splitMemberId: true, splitRatio: true, type: true, amount: true },
    }),

    prisma.transaction.findMany({
      where: { userId },
      select: { memberId: true, splitMemberId: true, splitRatio: true, type: true, amount: true },
    }),

    prisma.loan.findMany({
      where: { userId, isActive: true },
      select: { memberId: true, payerMemberId: true, remainingBalance: true, emi: true },
    }),

    prisma.investment.findMany({
      where: { userId },
      select: { memberId: true, splitMemberId: true, splitRatio: true, quantity: true, currentPrice: true },
    }),
  ]);

  const breakdown = members.map((m) => {
    const monthlyIncome   = monthlyTxns.filter((t) => t.type === 'INCOME').reduce((s, t) => s + txnShare(t as TxnRow, m.id), 0);
    const monthlyExpenses = monthlyTxns.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + txnShare(t as TxnRow, m.id), 0);
    const totalIncome     = allTxns.filter((t) => t.type === 'INCOME').reduce((s, t) => s + txnShare(t as TxnRow, m.id), 0);
    const totalExpenses   = allTxns.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + txnShare(t as TxnRow, m.id), 0);
    const loanOwed        = loans.filter((l) => l.memberId === m.id).reduce((s, l) => s + Number(l.remainingBalance), 0);
    const monthlyEMI      = loans.filter((l) => l.payerMemberId === m.id).reduce((s, l) => s + Number(l.emi), 0);
    const investmentValue = investments.reduce((s, i) => s + invShare(i as InvRow, m.id), 0);

    return {
      member: m,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings: monthlyIncome - monthlyExpenses,
      totalIncome,
      totalExpenses,
      loanOwed,
      monthlyEMI,
      investmentValue,
    };
  });

  const unassigned         = monthlyTxns.filter((t) => !t.memberId && !t.splitMemberId);
  const unassignedIncome   = unassigned.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
  const unassignedExpenses = unassigned.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

  return { breakdown, unassignedIncome, unassignedExpenses };
}
