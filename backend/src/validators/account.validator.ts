import { z } from 'zod';

export const createAccountSchema = z.object({
  name:     z.string().min(1).max(255),
  type:     z.enum(['SAVINGS', 'CHECKING', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'OTHER']),
  balance:  z.number().default(0),
  currency: z.string().length(3).default('INR'),
  color:    z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon:     z.string().max(10).optional(),
  memberId: z.string().cuid().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
