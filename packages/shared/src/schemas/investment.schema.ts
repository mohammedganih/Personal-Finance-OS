import { z } from 'zod';

const ASSET_TYPES = [
  'STOCK', 'MUTUAL_FUND', 'SIP', 'CRYPTO', 'ETF',
  'FIXED_DEPOSIT', 'RECURRING_DEPOSIT', 'REAL_ESTATE',
  'GOLD', 'GOLD_SCHEME', 'VEHICLE', 'OTHER',
] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createInvestmentSchema = z.object({
  assetName:     z.string().min(1).max(255),
  assetType:     z.enum(ASSET_TYPES),
  ticker:        z.string().max(20).optional(),
  quantity:      z.number().min(0).default(0),
  buyPrice:      z.number().min(0).default(0),
  currentPrice:  z.number().min(0).default(0),
  purchaseDate:  z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  exchange:      z.string().max(100).optional(),
  notes:         z.string().max(1000).optional(),

  // SIP / MF
  monthlyAmount: z.number().positive().optional(),
  fundCategory:  z.string().max(50).optional(),
  folioNumber:   z.string().max(50).optional(),

  // RD / FD / Gold Scheme
  maturityDate:   z.string().regex(dateRegex).optional(),
  maturityAmount: z.number().positive().optional(),
  interestRate:   z.number().min(0).max(100).optional(),

  // Common
  platform:      z.string().max(100).optional(),
  memberId:      z.string().cuid().optional(),
  splitMemberId: z.string().cuid().optional(),
  splitRatio:    z.number().min(0).max(100).optional(),
  bankAccountId: z.string().cuid().optional(),

  // Collateral assets (Real Estate / Vehicle)
  address:                  z.string().max(500).optional(),
  ownershipPercent:         z.number().min(0).max(100).optional(),
  expectedAppreciationRate: z.number().min(-100).max(100).optional(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial();

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
