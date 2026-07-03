import { z } from 'zod';

export const createLoanSchema = z.object({
  name:             z.string().min(1).max(255),
  loanType:         z.enum(['HOME', 'CAR', 'PERSONAL', 'EDUCATION', 'BUSINESS', 'OTHER']),
  principal:        z.number().positive(),
  interestRate:     z.number().min(0).max(100),
  emi:              z.number().positive(),
  remainingBalance: z.number().min(0),
  tenureMonths:     z.number().int().positive(),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lender:           z.string().max(255).optional(),
  notes:            z.string().max(1000).optional(),
  memberId:         z.string().cuid().optional(),  // borrower
  payerMemberId:    z.string().cuid().optional(),  // who pays EMI
  bankAccountId:    z.string().cuid().optional(),  // linked bank account
  linkedInvestmentId: z.string().cuid().nullable().optional(), // collateral asset (Property, Vehicle, ...)
});

export const updateLoanSchema = createLoanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
