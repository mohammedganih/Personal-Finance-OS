import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Signed balance impact of a transaction: income adds to the account,
 * expense subtracts from it. Centralized here so every call site that
 * touches Account.balance agrees on the sign convention.
 */
export function signedDelta(type: 'INCOME' | 'EXPENSE', amount: number): number {
  return type === 'INCOME' ? amount : -amount;
}

/**
 * Builds a Prisma operation that applies `delta` to an account's balance.
 * Meant to be included alongside other writes inside a `prisma.$transaction([...])`
 * array so the balance update is atomic with whatever transaction/payment caused it.
 */
export function balanceAdjustment(accountId: string, delta: number): Prisma.PrismaPromise<unknown> {
  return prisma.account.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}
