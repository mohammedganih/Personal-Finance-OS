import { prisma } from './prisma';
import { createError } from '../middleware/error.middleware';

type Id = string | null | undefined;

/** Ids a create/update links to. Each must belong to the user, or the request is a 404. */
export interface OwnedRefs {
  accounts?: Id[];
  /** The user's own categories plus the shared default ones (userId null). */
  categories?: Id[];
  members?: Id[];
  creditCards?: Id[];
  investments?: Id[];
  loans?: Id[];
}

const unique = (ids: Id[] = []) => Array.from(new Set(ids.filter((id): id is string => !!id)));

/**
 * Rejects any linked id that is not this user's, so one login can never point
 * its records (or move balances) at another household's data. null/undefined
 * ids are skipped: they mean "not linked" or "unchanged".
 */
export async function assertOwned(userId: string, refs: OwnedRefs): Promise<void> {
  const checks: [string[], (ids: string[]) => Promise<number>, string][] = [
    [unique(refs.accounts), (ids) => prisma.account.count({ where: { userId, id: { in: ids } } }), 'Account not found'],
    [unique(refs.categories), (ids) => prisma.category.count({ where: { id: { in: ids }, OR: [{ userId }, { userId: null }] } }), 'Category not found'],
    [unique(refs.members), (ids) => prisma.familyMember.count({ where: { userId, id: { in: ids } } }), 'Family member not found'],
    [unique(refs.creditCards), (ids) => prisma.creditCard.count({ where: { userId, id: { in: ids } } }), 'Credit card not found'],
    [unique(refs.investments), (ids) => prisma.investment.count({ where: { userId, id: { in: ids } } }), 'Investment not found'],
    [unique(refs.loans), (ids) => prisma.loan.count({ where: { userId, id: { in: ids } } }), 'Loan not found'],
  ];
  for (const [ids, count, message] of checks) {
    if (ids.length && (await count(ids)) !== ids.length) throw createError(message, 404);
  }
}
