import { randomUUID } from 'crypto';
import type { Transaction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { kindForType } from '../lib/ledger';
import { createError } from '../middleware/error.middleware';
import { signedDelta } from '../lib/accountBalance';
import { writeSplit, fetchSplits, attachSplit } from '../lib/ownershipSplit';
import { assertOwned } from '../lib/ownership';
import {
  CreateTransactionInput,
  CreateTransferInput,
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
        kind: kindForType(input.type),
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

/**
 * Moves money between two of the user's own accounts: one TRANSFER leg out of
 * `from` and one into `to`, sharing a transferGroupId, so it never counts as
 * income or spending. Both balances move in the same DB transaction.
 */
export async function createTransfer(userId: string, input: CreateTransferInput) {
  if (input.fromAccountId === input.toAccountId) throw createError('Pick two different accounts', 400);
  await assertOwned(userId, { accounts: [input.fromAccountId, input.toAccountId] });
  const [from, to] = await Promise.all([input.fromAccountId, input.toAccountId].map((id) => prisma.account.findUniqueOrThrow({ where: { id }, select: { name: true } })));
  const transferGroupId = randomUUID();
  const date = new Date(input.date);
  const common = { userId, amount: input.amount, date, kind: 'TRANSFER' as const, transferGroupId, notes: input.note };

  const legs = await prisma.$transaction(async (tx) => {
    const out = await tx.transaction.create({
      data: { ...common, type: 'EXPENSE', accountId: input.fromAccountId, description: `Transfer to ${to.name}` },
      include: TRANSACTION_INCLUDE,
    });
    const into = await tx.transaction.create({
      data: { ...common, type: 'INCOME', accountId: input.toAccountId, description: `Transfer from ${from.name}` },
      include: TRANSACTION_INCLUDE,
    });
    await tx.account.update({ where: { id: input.fromAccountId }, data: { balance: { decrement: input.amount } } });
    await tx.account.update({ where: { id: input.toAccountId }, data: { balance: { increment: input.amount } } });
    return [out, into];
  });
  return { transferGroupId, legs: legs.map(serializeTransaction) };
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);
  if (existing.transferGroupId) return updateTransferLeg(userId, existing, input);
  await assertOwned(userId, { accounts: [input.accountId], categories: [input.categoryId], members: [input.memberId, input.splitMemberId] });

  const transaction = await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        // The edit form always sends the type, so only re-derive `kind` when the type
        // really changes: otherwise an EMI (DEBT) or SIP (SAVE) entry would turn into
        // spending just by being saved, and count twice.
        ...(input.type        !== undefined && { type: input.type }),
        ...(input.type        !== undefined && input.type !== existing.type && { kind: kindForType(input.type) }),
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

/**
 * A transfer leg can change its date, description and notes (the date and notes
 * apply to both legs). Anything that would unbalance the pair is refused: delete
 * the transfer and add it again instead.
 */
async function updateTransferLeg(userId: string, existing: Transaction, input: UpdateTransactionInput) {
  const changed = (value: unknown, current: unknown) => value !== undefined && value !== null && value !== current;
  if (changed(input.type, existing.type) || changed(input.amount, Number(existing.amount)) || changed(input.accountId, existing.accountId)
    || changed(input.categoryId, existing.categoryId) || changed(input.memberId, existing.memberId) || input.splitMemberId) {
    throw createError('To change the amount or accounts of a transfer, delete it and add it again', 400);
  }
  await prisma.$transaction(async (tx) => {
    if (input.description !== undefined) await tx.transaction.update({ where: { id: existing.id }, data: { description: input.description } });
    await tx.transaction.updateMany({
      where: { userId, transferGroupId: existing.transferGroupId },
      data: {
        ...(input.date  !== undefined && { date: new Date(input.date) }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  });
  const updated = await prisma.transaction.findUniqueOrThrow({ where: { id: existing.id }, include: TRANSACTION_INCLUDE });
  return serializeTransaction(updated);
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Transaction not found', 404);

  // A transfer goes as a pair: remove both legs and undo both balance moves.
  if (existing.transferGroupId) {
    const legs = await prisma.transaction.findMany({ where: { userId, transferGroupId: existing.transferGroupId } });
    await prisma.$transaction(async (tx) => {
      for (const leg of legs) {
        await tx.transaction.delete({ where: { id: leg.id } });
        if (leg.accountId) {
          await tx.account.update({ where: { id: leg.accountId }, data: { balance: { increment: -signedDelta(leg.type, Number(leg.amount)) } } });
        }
      }
    });
    return;
  }

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

function serializeTransaction<T extends { amount: { toString(): string } }>(t: T) {
  return { ...t, amount: Number(t.amount) };
}
