import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createCreditCardSchema = z.object({
  cardName:       z.string().min(1).max(255),
  bank:           z.string().max(100).optional(),
  lastFourDigits: z.string().length(4).regex(/^\d{4}$/).optional(),
  creditLimit:    z.number().positive(),
  outstanding:    z.number().min(0).default(0),
  minimumPayment: z.number().min(0).optional(),
  dueDate:        z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  statementDate:  z.string().regex(dateRegex).optional(),
  interestRate:   z.number().min(0).max(100).optional(),
  color:          z.string().optional(),
  notes:          z.string().max(1000).optional(),
});

export const updateCreditCardSchema = createCreditCardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
