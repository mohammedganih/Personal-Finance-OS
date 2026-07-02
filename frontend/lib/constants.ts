import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  CreditCard,
  Repeat,
  BarChart3,
  Settings,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
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

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Savings',
  CHECKING: 'Current',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  CASH: 'Cash',
  OTHER: 'Other',
};

export const CHART_COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4',
  '#84CC16', '#F97316', '#6366F1', '#14B8A6',
];
