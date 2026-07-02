import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../validators/transaction.validator';

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
      include: {
        category:    { select: { id: true, name: true, icon: true, color: true } },
        account:     { select: { id: true, name: true, type: true } },
        member:      { select: { id: true, name: true, color: true, emoji: true } },
        splitMember: { select: { id: true, name: true, color: true, emoji: true } },
      },
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
  const transaction = await prisma.transaction.create({
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
    include: {
      category:    { select: { id: true, name: true, icon: true, color: true } },
      account:     { select: { id: true, name: true, type: true } },
      member:      { select: { id: true, name: true, color: true, emoji: true } },
      splitMember: { select: { id: true, name: true, color: true, emoji: true } },
    },
  });

  if (input.accountId) {
    const delta = input.type === 'INCOME' ? Number(input.amount) : -Number(input.amount);
    await prisma.account.update({
      where: { id: input.accountId },
      data: { balance: { increment: delta } },
    });
  }

  return serializeTransaction(transaction);
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);

  const transaction = await prisma.transaction.update({
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
    include: {
      category:    { select: { id: true, name: true, icon: true, color: true } },
      account:     { select: { id: true, name: true, type: true } },
      member:      { select: { id: true, name: true, color: true, emoji: true } },
      splitMember: { select: { id: true, name: true, color: true, emoji: true } },
    },
  });

  return serializeTransaction(transaction);
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);
  await prisma.transaction.delete({ where: { id } });
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
