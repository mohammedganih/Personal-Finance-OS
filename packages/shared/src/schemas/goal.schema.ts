import { z } from 'zod';

export const goalTypeEnum = z.enum([
  'FARM_HOUSE', 'EMERGENCY_FUND', 'RELOCATION', 'CAR_PURCHASE', 'RETIREMENT', 'TRAVEL', 'EDUCATION', 'CUSTOM',
]);

export const goalPriorityEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export const goalRiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const createGoalSchema = z.object({
  name:                  z.string().min(1).max(255),
  description:           z.string().max(1000).optional(),
  icon:                  z.string().max(10).optional(),
  color:                 z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  goalType:              goalTypeEnum.default('CUSTOM'),
  priority:              goalPriorityEnum.default('MEDIUM'),
  targetAmount:          z.number().positive('Target amount must be positive'),
  currentAmount:         z.number().min(0).default(0),
  targetDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  monthlyContribution:   z.number().min(0).optional(),
  expectedReturnRate:    z.number().min(0).max(100).optional(),
  expectedInflationRate: z.number().min(0).max(100).optional(),
  riskLevel:             goalRiskLevelEnum.optional(),
  fundingAccountId:      z.string().cuid().optional(),
  memberId:              z.string().cuid().optional(),
  notes:                 z.string().max(1000).optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const createGoalContributionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type:   z.enum(['RECURRING', 'ONE_TIME']).default('ONE_TIME'),
  notes:  z.string().max(500).optional(),
});

export type CreateGoalContributionInput = z.infer<typeof createGoalContributionSchema>;
