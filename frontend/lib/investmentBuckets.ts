import { AssetType } from '@/types';

// The reference design's 5 holding categories don't match any grouping that
// already exists: AssetType has 12 raw enum values, and the backend's
// AssetClass (Equity/Debt/Gold/Real Estate/Crypto/Other) lumps Mutual Fund,
// SIP, Stock and ETF all into one "Equity" bucket. This mapping is used by
// both the Asset Allocation donut and the Holdings table tabs, so a donut
// legend click and a table tab selection always refer to the same grouping.
export const HOLDING_BUCKETS = ['Mutual Funds', 'Stocks', 'Gold', 'Debt Funds', 'Cash & Others'] as const;

export type HoldingBucket = (typeof HOLDING_BUCKETS)[number];

const BUCKET_MAP: Record<AssetType, HoldingBucket> = {
  MUTUAL_FUND: 'Mutual Funds',
  SIP: 'Mutual Funds',
  STOCK: 'Stocks',
  ETF: 'Stocks',
  GOLD: 'Gold',
  GOLD_SCHEME: 'Gold',
  FIXED_DEPOSIT: 'Debt Funds',
  RECURRING_DEPOSIT: 'Debt Funds',
  REAL_ESTATE: 'Cash & Others',
  VEHICLE: 'Cash & Others',
  CRYPTO: 'Cash & Others',
  OTHER: 'Cash & Others',
};

export function bucketForAssetType(type: AssetType): HoldingBucket {
  return BUCKET_MAP[type] ?? 'Cash & Others';
}

// Drawn from the app's validated CVD-safe CHART_COLORS palette (lib/constants.ts).
export const BUCKET_COLORS: Record<HoldingBucket, string> = {
  'Mutual Funds': '#9085e9',
  Stocks: '#199e70',
  Gold: '#c98500',
  'Debt Funds': '#3987e5',
  'Cash & Others': '#8b8fa3',
};
