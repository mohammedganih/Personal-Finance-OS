import { prisma } from './prisma';

/**
 * Finds the category by name for a user. Returns null if not found.
 * Used when auto-creating transactions from EMI/bill payments.
 */
export async function findCategory(userId: string, name: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): Promise<string | null> {
  const cat = await prisma.category.findFirst({
    where: { userId, name, type },
    select: { id: true },
  });
  return cat?.id ?? null;
}

/**
 * The household's spending category with this name (ignoring case), created if
 * it doesn't exist yet -- so bills and card purchases share the one list that
 * transactions and budgets use.
 */
export async function categoryIdFor(userId: string, name: string | null | undefined): Promise<string | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const found = await prisma.category.findFirst({ where: { userId, type: 'EXPENSE', name: { equals: clean, mode: 'insensitive' } }, select: { id: true } });
  if (found) return found.id;
  return (await prisma.category.create({ data: { userId, name: clean, type: 'EXPENSE' }, select: { id: true } })).id;
}
