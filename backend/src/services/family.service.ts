import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateFamilyMemberInput, UpdateFamilyMemberInput } from '../validators/family.validator';

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
  // Total balance across all debts at the end of each month, starting with
  // month 0 (today) -- lets a caller plot the payoff as a curve, not just
  // read off its final totals.
  const schedule: number[] = [bal.reduce((s, l) => s + l.balance, 0)];

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
    schedule.push(bal.reduce((s, l) => s + l.balance, 0));
  }

  return { totalInterest, months, schedule };
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

