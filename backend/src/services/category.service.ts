import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { DEFAULT_CATEGORIES } from './auth.service';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/category.validator';

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

export async function createCategory(userId: string, input: CreateCategoryInput) {
  return prisma.category.create({
    data: { userId, ...input, isDefault: false },
  });
}

export async function updateCategory(userId: string, id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Category not found', 404);
  if (existing.isDefault) throw createError('Default categories cannot be edited', 400);

  return prisma.category.update({ where: { id }, data: input });
}

export async function deleteCategory(userId: string, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Category not found', 404);
  if (existing.isDefault) throw createError('Default categories cannot be deleted', 400);

  await prisma.category.delete({ where: { id } });
}
