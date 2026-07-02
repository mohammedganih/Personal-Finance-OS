import { z } from 'zod';

export const createBudgetSchema = z.object({
  categoryId:   z.string().cuid(),
  monthlyLimit: z.number().positive('Monthly limit must be positive'),
});

// categoryId is intentionally not editable -- changing what a budget is for
// is a delete-and-recreate, not an update.
export const updateBudgetSchema = z.object({
  monthlyLimit: z.number().positive('Monthly limit must be positive'),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
