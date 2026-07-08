import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  CreditCard,
  Receipt,
  BarChart3,
  Settings,
  PiggyBank,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/investments', label: 'Investments', icon: TrendingUp },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/bills', label: 'Bills', icon: Receipt },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK:             'Stock',
  MUTUAL_FUND:       'Mutual Fund',
  SIP:               'SIP',
  CRYPTO:            'Crypto',
  ETF:               'ETF',
  FIXED_DEPOSIT:     'Fixed Deposit',
  RECURRING_DEPOSIT: 'Recurring Deposit',
  REAL_ESTATE:       'Real Estate',
  GOLD:              'Gold',
  GOLD_SCHEME:       'Gold Scheme',
  VEHICLE:           'Vehicle',
  OTHER:             'Other',
};

export const ASSET_TYPE_ICONS: Record<string, string> = {
  STOCK:             '📈',
  MUTUAL_FUND:       '📊',
  SIP:               '🔄',
  CRYPTO:            '₿',
  ETF:               '🗂️',
  FIXED_DEPOSIT:     '🏦',
  RECURRING_DEPOSIT: '💰',
  REAL_ESTATE:       '🏠',
  GOLD:              '🥇',
  GOLD_SCHEME:       '✨',
  VEHICLE:           '🚗',
  OTHER:             '💼',
};

export const INVESTMENT_PLATFORMS = [
  'Zerodha', 'Groww', 'Kuvera', 'Coin (Zerodha)',
  'CRED', 'Angel One', 'Upstox', 'INDmoney',
  'Paytm Money', 'ET Money', 'MF Central',
  'Bank Branch', 'Post Office', 'Other',
] as const;

export const FUND_CATEGORIES = [
  'Large Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'Multi Cap',
  'ELSS', 'Index', 'Debt', 'Liquid', 'Hybrid', 'International', 'Sectoral',
] as const;

export const LOAN_TYPE_LABELS: Record<string, string> = {
  HOME: 'Home Loan',
  CAR: 'Car Loan',
  PERSONAL: 'Personal Loan',
  EDUCATION: 'Education Loan',
  BUSINESS: 'Business Loan',
  OTHER: 'Other',
};

// ─── Recurring Bills & Commitments ────────────────────────────────────────────

export const BILL_FREQUENCY_LABELS: Record<string, string> = {
  ONE_TIME: 'One Time',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
  EVERY_2_MONTHS: 'Every 2 Months',
  QUARTERLY: 'Quarterly',
  EVERY_4_MONTHS: 'Every 4 Months',
  HALF_YEARLY: 'Half Yearly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom Interval',
};

export const BILL_FREQUENCY_SHORT: Record<string, string> = {
  ONE_TIME: 'once',
  WEEKLY: '/wk',
  BIWEEKLY: '/2wk',
  MONTHLY: '/mo',
  EVERY_2_MONTHS: '/2mo',
  QUARTERLY: '/qtr',
  EVERY_4_MONTHS: '/4mo',
  HALF_YEARLY: '/6mo',
  YEARLY: '/yr',
  CUSTOM: '',
};

// Icons + colors for the suggested categories (colors come from the validated
// CHART_COLORS palette below so category charts stay CVD-safe). Free-form
// custom categories fall back to BILL_CATEGORY_FALLBACK.
export const BILL_CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Entertainment:        { icon: '🎬', color: '#9085e9' },
  Utilities:            { icon: '💡', color: '#3987e5' },
  Insurance:            { icon: '🛡️', color: '#199e70' },
  Fitness:              { icon: '💪', color: '#008300' },
  Finance:              { icon: '🏦', color: '#c98500' },
  Software:             { icon: '🧑‍💻', color: '#d55181' },
  Education:            { icon: '🎓', color: '#d95926' },
  Transport:            { icon: '🚇', color: '#3987e5' },
  Lifestyle:            { icon: '🧺', color: '#e66767' },
  Family:               { icon: '👨‍👩‍👧', color: '#d55181' },
  Housing:              { icon: '🏠', color: '#c98500' },
  Healthcare:           { icon: '🩺', color: '#199e70' },
  'Taxes & Government': { icon: '🏛️', color: '#d95926' },
  Other:                { icon: '📦', color: '#8b8fa3' },
};

export const BILL_CATEGORY_FALLBACK = { icon: '📦', color: '#8b8fa3' };

export function billCategoryMeta(category: string): { icon: string; color: string } {
  return BILL_CATEGORY_META[category] ?? BILL_CATEGORY_FALLBACK;
}

export const BILL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
};

export const GOAL_TYPE_LABELS: Record<string, string> = {
  FARM_HOUSE: 'Farm House',
  EMERGENCY_FUND: 'Emergency Fund',
  RELOCATION: 'Relocation',
  CAR_PURCHASE: 'Car Purchase',
  RETIREMENT: 'Retirement',
  TRAVEL: 'International Trip',
  EDUCATION: 'Child Education',
  CUSTOM: 'Custom Goal',
};

export const GOAL_TYPE_ICONS: Record<string, string> = {
  FARM_HOUSE: '🏡',
  EMERGENCY_FUND: '🛟',
  RELOCATION: '✈️',
  CAR_PURCHASE: '🚗',
  RETIREMENT: '🌅',
  TRAVEL: '🌍',
  EDUCATION: '🎓',
  CUSTOM: '🎯',
};

export const GOAL_PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const GOAL_RISK_LABELS: Record<string, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Savings',
  CHECKING: 'Current',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  CASH: 'Cash',
  OTHER: 'Other',
};

// Fixed order is the CVD-safety mechanism, not cosmetic -- validated with
// scripts/validate_palette.js (dataviz skill) against this app's dark
// surface: lightness band, chroma floor, and adjacent-pair color-blindness
// separation all pass. Do not reorder or insert colors without re-running
// the validator; a 9th color should fold into "Other", not extend this list.
export const CHART_COLORS = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
];
