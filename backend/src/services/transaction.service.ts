import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { signedDelta, balanceAdjustment } from '../lib/accountBalance';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../validators/transaction.validator';

const TRANSACTION_INCLUDE = {
  category:    { select: { id: true, name: true, icon: true, color: true } },
  account:     { select: { id: true, name: true, type: true } },
  member:      { select: { id: true, name: true, color: true, emoji: true } },
  splitMember: { select: { id: true, name: true, color: true, emoji: true } },
} as const;

export async function getTransactions(userId: string, query: TransactionQuery) {
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(query.type && { type: query.type }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.accountId && { accountId: query.accountId }),
    ...(query.memberId && { memberId: query.memberId }),
    ...(query.search && {
      description: { contains: query.search, mode: 'insensitive' as const },
    }),
    ...((query.startDate || query.endDate) && {
      date: {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      },
    }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: TRANSACTION_INCLUDE,
      orderBy: { [query.sortBy || 'date']: query.sortOrder || 'desc' },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map(serializeTransaction),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        notes:       input.notes,
        date:        new Date(input.date),
        categoryId:  input.categoryId,
        accountId:   input.accountId,
        memberId:      input.memberId,
        splitMemberId: input.splitMemberId,
        splitRatio:    input.splitRatio,
        isRecurring:   input.isRecurring ?? false,
      },
      include: TRANSACTION_INCLUDE,
    }),
  ];

  if (input.accountId) {
    ops.push(balanceAdjustment(input.accountId, signedDelta(input.type, Number(input.amount))));
  }

  const [transaction] = await prisma.$transaction(ops);
  return serializeTransaction(transaction as Record<string, unknown>);
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.transaction.update({
      where: { id },
      data: {
        ...(input.type          !== undefined && { type: input.type }),
        ...(input.amount        !== undefined && { amount: input.amount }),
        ...(input.description   !== undefined && { description: input.description }),
        ...(input.notes         !== undefined && { notes: input.notes }),
        ...(input.date          !== undefined && { date: new Date(input.date) }),
        ...(input.categoryId    !== undefined && { categoryId:    input.categoryId    ?? null }),
        ...(input.accountId     !== undefined && { accountId:     input.accountId     ?? null }),
        ...(input.memberId      !== undefined && { memberId:      input.memberId      ?? null }),
        ...(input.splitMemberId !== undefined && { splitMemberId: input.splitMemberId ?? null }),
        ...(input.splitRatio    !== undefined && { splitRatio:    input.splitRatio }),
        ...(input.isRecurring   !== undefined && { isRecurring:   input.isRecurring }),
      },
      include: TRANSACTION_INCLUDE,
    }),
  ];

  // Reverse the old balance impact (if it was linked to an account)...
  if (existing.accountId) {
    ops.push(balanceAdjustment(existing.accountId, -signedDelta(existing.type, Number(existing.amount))));
  }

  // ...then apply the new balance impact (account/type/amount may all have changed).
  const newAccountId = input.accountId !== undefined ? input.accountId : existing.accountId;
  if (newAccountId) {
    const newType   = input.type ?? existing.type;
    const newAmount = input.amount !== undefined ? input.amount : Number(existing.amount);
    ops.push(balanceAdjustment(newAccountId, signedDelta(newType, Number(newAmount))));
  }

  const [transaction] = await prisma.$transaction(ops);
  return serializeTransaction(transaction as Record<string, unknown>);
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);

  const ops: Prisma.PrismaPromise<unknown>[] = [prisma.transaction.delete({ where: { id } })];

  if (existing.accountId) {
    ops.push(balanceAdjustment(existing.accountId, -signedDelta(existing.type, Number(existing.amount))));
  }

  await prisma.$transaction(ops);
}

export async function getTransactionSummary(userId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    select: { type: true, amount: true },
  });

  const income = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return { income, expenses, savings: income - expenses };
}

function serializeTransaction(t: Record<string, unknown>) {
  return { ...t, amount: Number((t as { amount: { toString(): string } }).amount) };
}
