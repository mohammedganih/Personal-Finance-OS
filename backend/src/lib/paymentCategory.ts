import { prisma } from './prisma';

/**
 * Finds the category by name for a user. Returns null if not found.
 * Used when auto-creating transactions from EMI/bill payments.
 */
export async function findCategory(userId: string, name: string): Promise<string | null> {
  const cat = await prisma.category.findFirst({
    where: { userId, name, type: 'EXPENSE' },
    select: { id: true },
  });
  return cat?.id ?? null;
}
