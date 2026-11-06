import { prisma } from '../lib/prisma';
import { assertOwned } from '../lib/ownership';
import { createError } from '../middleware/error.middleware';
import { CreateAccountInput, UpdateAccountInput } from '../validators/account.validator';

export async function getAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map((a) => ({ ...a, balance: Number(a.balance), preferredMinimum: Number(a.preferredMinimum) }));
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  await validateMember(userId, input.memberId);
  const account = await prisma.account.create({
    data: { userId, ...input },
  });
  return { ...account, balance: Number(account.balance), preferredMinimum: Number(account.preferredMinimum) };
}

export async function updateAccount(userId: string, id: string, input: UpdateAccountInput) {
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Account not found', 404);
  await validateMember(userId, input.memberId);
  const account = await prisma.account.update({ where: { id }, data: input });
  return { ...account, balance: Number(account.balance), preferredMinimum: Number(account.preferredMinimum) };
}

export async function deleteAccount(userId: string, id: string) {
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Account not found', 404);
  await prisma.account.delete({ where: { id } });
}

async function validateMember(userId: string, memberId?: string | null) {
  await assertOwned(userId, { members: [memberId] });
}
