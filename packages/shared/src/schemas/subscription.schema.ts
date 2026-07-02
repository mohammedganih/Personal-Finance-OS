import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  serviceName: z.string().min(1).max(255),
  amount: z.number().positive('Amount must be positive'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  category: z.string().max(100).optional(),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
