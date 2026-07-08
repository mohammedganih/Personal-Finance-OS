import { z } from 'zod';

// ─── Recurring Bills & Commitments ───────────────────────────────────────────

export const BILL_FREQUENCIES = [
  'ONE_TIME',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'EVERY_2_MONTHS',
  'QUARTERLY',
  'EVERY_4_MONTHS',
  'HALF_YEARLY',
  'YEARLY',
  'CUSTOM',
] as const;

export type BillFrequencyValue = (typeof BILL_FREQUENCIES)[number];

export const BILL_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type BillStatusValue = (typeof BILL_STATUSES)[number];

/**
 * Suggested categories. Bills store category as a free-form string so users
 * can create unlimited custom categories; this list only powers pickers,
 * icons, and colors on the frontend.
 */
export const BILL_CATEGORIES = [
  'Entertainment',
  'Utilities',
  'Insurance',
  'Fitness',
  'Finance',
  'Software',
  'Education',
  'Transport',
  'Lifestyle',
  'Family',
  'Housing',
  'Healthcare',
  'Taxes & Government',
  'Other',
] as const;

export const BILL_PAYMENT_METHODS = [
  'UPI',
  'Auto Debit (Bank)',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Cash',
  'Wallet',
  'Standing Instruction',
  'Other',
] as const;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const billCore = z.object({
  name: z.string().min(1, 'Name required').max(120),
  vendor: z.string().max(120).optional(),
  category: z.string().min(1).max(60).default('Other'),
  icon: z.string().max(16).optional(),
  color: z.string().max(20).optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('INR'),
  frequency: z.enum(BILL_FREQUENCIES).default('MONTHLY'),
  customIntervalDays: z.number().int().min(1).max(3650).optional(),
  startDate: dateString,
  endDate: dateString.optional().nullable(),
  reminderDays: z.number().int().min(0).max(60).default(3),
  autoDebit: z.boolean().default(false),
  paymentMethod: z.string().max(60).optional(),
  accountId: z.string().optional().nullable(),
  creditCardId: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
});

function requireCustomInterval(data: { frequency?: string; customIntervalDays?: number }) {
  return data.frequency !== 'CUSTOM' || (data.customIntervalDays ?? 0) >= 1;
}

function endAfterStart(data: { startDate?: string; endDate?: string | null }) {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
}

export const createBillSchema = billCore
  .refine(requireCustomInterval, { message: 'Custom frequency needs an interval in days', path: ['customIntervalDays'] })
  .refine(endAfterStart, { message: 'End date must be on or after the start date', path: ['endDate'] });

export const updateBillSchema = billCore
  .partial()
  .extend({ status: z.enum(BILL_STATUSES).optional() })
  .refine(requireCustomInterval, { message: 'Custom frequency needs an interval in days', path: ['customIntervalDays'] })
  .refine(endAfterStart, { message: 'End date must be on or after the start date', path: ['endDate'] });

// ─── Occurrence actions ──────────────────────────────────────────────────────

export const payBillOccurrenceSchema = z.object({
  dueDate: dateString,
  amount: z.number().positive().optional(), // defaults to the bill's amount
  paidDate: dateString.optional(), // defaults to today
  accountId: z.string().optional().nullable(), // overrides the bill's linked account
  createTransaction: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const skipBillOccurrenceSchema = z.object({
  dueDate: dateString,
  notes: z.string().max(500).optional(),
});

export const undoBillOccurrenceSchema = z.object({
  dueDate: dateString,
});

export const pauseBillSchema = z.object({
  // null/omitted = paused until manually resumed
  pausedUntil: dateString.optional().nullable(),
});

// ─── Bulk operations ─────────────────────────────────────────────────────────

export const BILL_BULK_ACTIONS = [
  'delete',
  'archive',
  'restore',
  'pause',
  'resume',
  'setCategory',
  'setFrequency',
] as const;

export const bulkBillActionSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    action: z.enum(BILL_BULK_ACTIONS),
    category: z.string().min(1).max(60).optional(),
    frequency: z.enum(BILL_FREQUENCIES).optional(),
    customIntervalDays: z.number().int().min(1).max(3650).optional(),
    pausedUntil: dateString.optional().nullable(),
  })
  .refine((d) => d.action !== 'setCategory' || !!d.category, {
    message: 'category is required for setCategory',
    path: ['category'],
  })
  .refine((d) => d.action !== 'setFrequency' || !!d.frequency, {
    message: 'frequency is required for setFrequency',
    path: ['frequency'],
  })
  .refine((d) => d.action !== 'setFrequency' || d.frequency !== 'CUSTOM' || (d.customIntervalDays ?? 0) >= 1, {
    message: 'Custom frequency needs an interval in days',
    path: ['customIntervalDays'],
  });

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type PayBillOccurrenceInput = z.infer<typeof payBillOccurrenceSchema>;
export type SkipBillOccurrenceInput = z.infer<typeof skipBillOccurrenceSchema>;
export type UndoBillOccurrenceInput = z.infer<typeof undoBillOccurrenceSchema>;
export type PauseBillInput = z.infer<typeof pauseBillSchema>;
export type BulkBillActionInput = z.infer<typeof bulkBillActionSchema>;
