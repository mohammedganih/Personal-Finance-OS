import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type SplitEntityType = 'TRANSACTION' | 'INVESTMENT';
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
