import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { signedDelta } from '../lib/accountBalance';
import { writeSplit, fetchSplits, attachSplit } from '../lib/ownershipSplit';
import { assertOwned } from '../lib/ownership';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../validators/transaction.validator';

const TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  account:  { select: { id: true, name: true, type: true } },
  member:   { select: { id: true, name: true, color: true, emoji: true } },
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

  const splits = await fetchSplits('TRANSACTION', transactions.map((t) => t.id));

  return {
    transactions: transactions.map((t) => serializeTransaction(attachSplit(t, splits.get(t.id)))),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  await assertOwned(userId, { accounts: [input.accountId], categories: [input.categoryId], members: [input.memberId, input.splitMemberId] });
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        notes:       input.notes,
        date:        new Date(input.date),
        categoryId:  input.categoryId,
        accountId:   input.accountId,
        memberId:    input.memberId,
        isRecurring: input.isRecurring ?? false,
      },
      include: TRANSACTION_INCLUDE,
    });

    if (input.accountId) {
      await tx.account.update({
        where: { id: input.accountId },
        data: { balance: { increment: signedDelta(input.type, Number(input.amount)) } },
      });
    }

    await writeSplit(tx, userId, 'TRANSACTION', created.id, input);

    return created;
  });

  const splits = await fetchSplits('TRANSACTION', [transaction.id]);
  return serializeTransaction(attachSplit(transaction, splits.get(transaction.id)));
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);
  await assertOwned(userId, { accounts: [input.accountId], categories: [input.categoryId], members: [input.memberId, input.splitMemberId] });

  const transaction = await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...(input.type        !== undefined && { type: input.type }),
        ...(input.amount      !== undefined && { amount: input.amount }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.notes       !== undefined && { notes: input.notes }),
        ...(input.date        !== undefined && { date: new Date(input.date) }),
        ...(input.categoryId  !== undefined && { categoryId: input.categoryId ?? null }),
        ...(input.accountId   !== undefined && { accountId:  input.accountId  ?? null }),
        ...(input.memberId    !== undefined && { memberId:   input.memberId   ?? null }),
        ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
      },
      include: TRANSACTION_INCLUDE,
    });

    // Reverse the old balance impact (if it was linked to an account)...
    if (existing.accountId) {
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: -signedDelta(existing.type, Number(existing.amount)) } },
      });
    }

    // ...then apply the new balance impact (account/type/amount may all have changed).
    const newAccountId = input.accountId !== undefined ? input.accountId : existing.accountId;
    if (newAccountId) {
      const newType   = input.type ?? existing.type;
      const newAmount = input.amount !== undefined ? input.amount : Number(existing.amount);
      await tx.account.update({
        where: { id: newAccountId },
        data: { balance: { increment: signedDelta(newType, Number(newAmount)) } },
      });
    }

    if (input.splitMemberId !== undefined) {
      await writeSplit(tx, userId, 'TRANSACTION', id, input);
    }

    return updated;
  });

  const splits = await fetchSplits('TRANSACTION', [id]);
  return serializeTransaction(attachSplit(transaction, splits.get(id)));
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } });

    if (existing.accountId) {
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: -signedDelta(existing.type, Number(existing.amount)) } },
      });
    }

    await tx.ownershipSplit.deleteMany({ where: { entityType: 'TRANSACTION', entityId: id } });
  });
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

function serializeTransaction<T extends { amount: { toString(): string } }>(t: T) {
  return { ...t, amount: Number(t.amount) };
}
