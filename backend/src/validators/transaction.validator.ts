import { z } from 'zod';

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  categoryId:    z.string().cuid().optional(),
  accountId:     z.string().cuid().optional(),
  memberId:      z.string().cuid().optional(),
  splitMemberId: z.string().cuid().optional(),
  splitRatio:    z.number().min(0).max(100).optional(),
  isRecurring:   z.boolean().default(false),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  categoryId: z.string().cuid().optional(),
  accountId: z.string().cuid().optional(),
  memberId:  z.string().cuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['date', 'amount', 'createdAt']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
