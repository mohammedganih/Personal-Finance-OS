import { prisma } from '../lib/prisma';
import { DEFAULT_CATEGORIES } from './auth.service';

export async function getCategories(userId: string) {
  // Auto-seed any missing default categories for this user on every fetch
  const existing = await prisma.category.findMany({
    where: { userId },
    select: { name: true, type: true },
  });

  const existingSet = new Set(existing.map((c) => `${c.name}::${c.type}`));
  const missing = DEFAULT_CATEGORIES.filter(
    (c) => !existingSet.has(`${c.name}::${c.type}`)
  );

  if (missing.length > 0) {
    await prisma.category.createMany({
      data: missing.map((c) => ({ ...c, userId, isDefault: true })),
      skipDuplicates: true,
    });
  }

  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}
