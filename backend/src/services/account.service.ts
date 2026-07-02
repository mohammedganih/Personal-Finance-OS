import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateAccountInput, UpdateAccountInput } from '../validators/account.validator';

export async function getAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map((a) => ({ ...a, balance: Number(a.balance) }));
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const account = await prisma.account.create({
    data: { userId, ...input },
  });
  return { ...account, balance: Number(account.balance) };
}

export async function updateAccount(userId: string, id: string, input: UpdateAccountInput) {
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Account not found', 404);
  const account = await prisma.account.update({ where: { id }, data: input });
  return { ...account, balance: Number(account.balance) };
}

export async function deleteAccount(userId: string, id: string) {
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Account not found', 404);
  await prisma.account.delete({ where: { id } });
}
