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

/** Money moved between two of our own accounts: neither income nor spending. */
export const createTransferSchema = z.object({
  fromAccountId: z.string().cuid(),
  toAccountId:   z.string().cuid(),
  amount:        z.number().positive('Amount must be positive').max(1e12),
  date:          z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  note:          z.string().max(255).optional(),
}).refine((t) => t.fromAccountId !== t.toAccountId, { message: 'Pick two different accounts', path: ['toAccountId'] });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
