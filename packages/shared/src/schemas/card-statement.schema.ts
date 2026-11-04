import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string().regex(dateRegex, 'Date must be YYYY-MM-DD');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
const money = z.coerce.number().finite().min(0).max(1e10);

/** A monthly card statement, as printed. Saving one for the same due month replaces it. */
export const saveCardStatementSchema = z.object({
  statementDate: date,
  dueDate:       date,
  /** First day of the billing period; defaults to the day after the previous statement. */
  periodStart:   date.optional(),
  totalDue:      money,
  minimumDue:    money.optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
}).refine(s => s.dueDate >= s.statementDate, { message: 'Due date must be on or after the statement date', path: ['dueDate'] })
  .refine(s => !s.periodStart || s.periodStart <= s.statementDate, { message: 'Period must start before the statement date', path: ['periodStart'] });

export const CARD_EXPENSE_LINK_TYPES = ['INVESTMENT', 'LOAN', 'BILL'] as const;

const payNow = z.object({
  accountId: z.string().min(1).optional().nullable(),
  paidDate:  date.optional(),
});

const cardExpenseCore = z.object({
  creditCardId:   z.string().min(1),
  name:           z.string().trim().min(1).max(120),
  amount:         z.coerce.number().positive().max(1e10),
  date,
  category:       z.string().trim().min(1).max(60).optional(),
  memberId:       z.string().min(1).optional().nullable(),
  /** Due month of the statement it bills on; worked out from the date when left out. */
  statementMonth: month.optional(),
  linkedType:     z.enum(CARD_EXPENSE_LINK_TYPES).optional().nullable(),
  linkedId:       z.string().min(1).optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
});

/** A one-off purchase on a card (not an EMI). `payNow` records paying it off straight away. */
export const createCardExpenseSchema = cardExpenseCore.extend({ payNow: payNow.optional() })
  .refine(e => !e.linkedType === !e.linkedId, { message: 'linkedType and linkedId go together', path: ['linkedId'] });
export const updateCardExpenseSchema = cardExpenseCore.partial();
export const payCardExpenseSchema = payNow;

export const payCreditCardBillSchema = z.object({
  amount:    z.coerce.number().positive().max(1e10),
  accountId: z.string().min(1).optional().nullable(),
  /** Due month of the statement being paid; defaults to the card's current one. */
  month:     month.optional(),
  paidDate:  date.optional(),
});

export type SaveCardStatementInput = z.infer<typeof saveCardStatementSchema>;
export type CreateCardExpenseInput = z.infer<typeof createCardExpenseSchema>;
export type UpdateCardExpenseInput = z.infer<typeof updateCardExpenseSchema>;
export type PayCardExpenseInput = z.infer<typeof payCardExpenseSchema>;
export type PayCreditCardBillInput = z.infer<typeof payCreditCardBillSchema>;
