import { z } from 'zod';

export const createCardEMISchema = z.object({
  creditCardId: z.string().cuid(),
  itemName:     z.string().min(1).max(255),
  totalAmount:  z.number().positive(),
  emiAmount:    z.number().positive(),
  tenureMonths: z.number().int().positive(),
  emisPaid:     z.number().int().min(0).default(0),
  isNoCost:     z.boolean().default(true),
  interestRate: z.number().min(0).max(100).optional(),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:        z.string().max(500).optional(),
});

export const updateCardEMISchema = z.object({
  itemName:     z.string().min(1).max(255).optional(),
  totalAmount:  z.number().positive().optional(),
  emiAmount:    z.number().positive().optional(),
  tenureMonths: z.number().int().positive().optional(),
  emisPaid:     z.number().int().min(0).optional(),
  isNoCost:     z.boolean().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:        z.string().max(500).optional(),
  isArchived:   z.boolean().optional(),
});

export type CreateCardEMIInput = z.infer<typeof createCardEMISchema>;
export type UpdateCardEMIInput = z.infer<typeof updateCardEMISchema>;
