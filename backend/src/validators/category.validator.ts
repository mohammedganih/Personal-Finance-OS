import { z } from 'zod';

export const createCategorySchema = z.object({
  name:  z.string().min(1).max(100),
  type:  z.enum(['INCOME', 'EXPENSE']),
  icon:  z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
