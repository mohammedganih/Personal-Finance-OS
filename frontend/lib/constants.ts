import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  CreditCard,
  Repeat,
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
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
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

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half Yearly',
  YEARLY: 'Yearly',
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
