import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { createError } from '../middleware/error.middleware';

type SplitEntityType = 'TRANSACTION' | 'INVESTMENT' | 'LOAN' | 'BILL' | 'CARD_EMI';
type Client = Prisma.TransactionClient;

export interface SplitInput {
  // Typed loosely (vs. the stricter `string | undefined` on the Zod input
  // types) because the frontend genuinely sends `null` at runtime to clear
  // an existing split -- the same runtime-vs-type gap the old direct-column
  // code already leaned on via `input.splitMemberId ?? null`.
  splitMemberId?: string | null;
  splitRatio?: number | null;
}

export interface SplitFields {
  splitMemberId: string | null;
  splitRatio: number | null;
  splitMember: { id: string; name: string; color: string | null; emoji: string | null } | null;
}

const EMPTY_SPLIT: SplitFields = { splitMemberId: null, splitRatio: null, splitMember: null };

/**
 * Create, replace, or remove the OwnershipSplit overlay row for one entity.
 * Must run inside the same DB transaction as the entity write so the entity
 * and its split stay consistent. `undefined` (field omitted on a partial
 * update) leaves any existing split untouched; explicit `null` removes it.
 */
export async function writeSplit(
  tx: Client,
  userId: string,
  entityType: SplitEntityType,
  entityId: string,
  input: SplitInput
): Promise<void> {
  if (input.splitMemberId) {
    await tx.ownershipSplit.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { userId, entityType, entityId, secondaryMemberId: input.splitMemberId, ratio: input.splitRatio ?? 50 },
      update: { secondaryMemberId: input.splitMemberId, ratio: input.splitRatio ?? 50 },
    });
  } else if (input.splitMemberId === null) {
    await tx.ownershipSplit.deleteMany({ where: { entityType, entityId } });
  }
}

export async function deleteSplit(tx: Client, entityType: SplitEntityType, entityId: string): Promise<void> {
  await tx.ownershipSplit.deleteMany({ where: { entityType, entityId } });
}

/** Batched fetch for list endpoints -- one query for all entityIds instead of N+1. */
export async function fetchSplits(entityType: SplitEntityType, entityIds: string[]): Promise<Map<string, SplitFields>> {
  if (!entityIds.length) return new Map();

  const rows = await prisma.ownershipSplit.findMany({
    where: { entityType, entityId: { in: entityIds } },
    include: { secondaryMember: { select: { id: true, name: true, color: true, emoji: true } } },
  });

  const map = new Map<string, SplitFields>();
  for (const row of rows) {
    map.set(row.entityId, {
      splitMemberId: row.secondaryMemberId,
      splitRatio: row.ratio.toNumber(),
      splitMember: row.secondaryMember,
    });
  }
  return map;
}

export function attachSplit<T extends Record<string, unknown>>(entity: T, split: SplitFields | undefined): T & SplitFields {
  return { ...entity, ...(split ?? EMPTY_SPLIT) };
}

/**
 * Gives the expense transactions a payment created the same split as the item
 * paid (e.g. a 50/50 RD), so Analytics and Transactions show each person's share.
 */
export async function copySplitToTransactions(tx: Client, userId: string, entityType: SplitEntityType, entityId: string, transactionIds: string[]): Promise<void> {
  if (!transactionIds.length) return;
  const split = await tx.ownershipSplit.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  if (!split) return;
  for (const id of transactionIds) {
    await tx.ownershipSplit.upsert({
      where: { entityType_entityId: { entityType: 'TRANSACTION', entityId: id } },
      create: { userId, entityType: 'TRANSACTION', entityId: id, secondaryMemberId: split.secondaryMemberId, ratio: split.ratio },
      update: { secondaryMemberId: split.secondaryMemberId, ratio: split.ratio },
    });
  }
}

/** Removes the split rows of transactions that are being deleted (no FK cascades them). */
export async function deleteTransactionSplits(tx: Client, transactionIds: string[]): Promise<void> {
  if (transactionIds.length) await tx.ownershipSplit.deleteMany({ where: { entityType: 'TRANSACTION', entityId: { in: transactionIds } } });
}

/** Rejects family member ids that are not this user's (null/undefined are fine). */
export async function assertOwnMembers(userId: string, ids: (string | null | undefined)[]): Promise<void> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (!wanted.length) return;
  const found = await prisma.familyMember.count({ where: { userId, id: { in: wanted } } });
  if (found !== wanted.length) throw createError('Family member not found', 404);
}

/** Saves (or clears, with splitMemberId: null) an item's split outside a transaction. */
export async function saveSplit(userId: string, entityType: SplitEntityType, entityId: string, input: SplitInput): Promise<void> {
  await writeSplit(prisma as unknown as Client, userId, entityType, entityId, input);
}
