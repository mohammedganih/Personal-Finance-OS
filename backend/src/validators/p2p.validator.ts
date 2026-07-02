import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createP2PSchema = z.object({
  personName:     z.string().min(1).max(255),
  type:           z.enum(['LENT', 'BORROWED']),
  amount:         z.number().positive(),
  remainingAmount: z.number().min(0),
  date:           z.string().regex(dateRegex),
  dueDate:        z.string().regex(dateRegex).optional(),
  description:    z.string().max(500).optional(),
  notes:          z.string().max(1000).optional(),
});

export const updateP2PSchema = createP2PSchema.partial().extend({
  isSettled: z.boolean().optional(),
});

export type CreateP2PInput = z.infer<typeof createP2PSchema>;
export type UpdateP2PInput = z.infer<typeof updateP2PSchema>;
