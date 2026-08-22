import {
  Landmark, Wallet, CreditCard as CreditCardIcon, TrendingUp, PieChart, Coins, Building2, LucideIcon,
} from 'lucide-react';
import { Account, AccountType, CreditCard, InvestmentWithPnl, Loan, FamilyMember } from '@/types';
import { LOAN_TYPE_ICONS, LOAN_TYPE_COLORS, CREDIT_CARD_BUCKET_COLOR } from './loanTypeMeta';
import { LOAN_TYPE_LABELS, ACCOUNT_TYPE_LABELS, ASSET_TYPE_LABELS } from './constants';
import { bucketForAssetType, BUCKET_COLORS, HoldingBucket } from './investmentBuckets';

export const LEDGER_BUCKETS = ['Bank', 'Credit Card', 'Investment', 'Loan', 'Cash'] as const;
export type LedgerBucket = (typeof LEDGER_BUCKETS)[number];

export type LedgerSourceType = 'account' | 'creditCard' | 'investment' | 'loan';

export interface LedgerRow {
  id: string;
  sourceType: LedgerSourceType;
  name: string;
  bucket: LedgerBucket;
  typeLabel: string;
  institution: string | null;
  maskedNumber: string | null;
  balance: number; // always a positive magnitude -- isLiability carries the sign meaning
  isLiability: boolean;
  balanceLabel: string;
  icon: LucideIcon;
  color: string;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  account?: Account; // only set for sourceType 'account' -- the one type this table can edit/delete inline
}

const ACCOUNT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  SAVINGS: Landmark, CHECKING: Landmark, CASH: Wallet, CREDIT_CARD: CreditCardIcon, INVESTMENT: TrendingUp, OTHER: Building2,
};

const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  SAVINGS: '#3987e5', CHECKING: '#3987e5', CASH: '#8b8fa3', CREDIT_CARD: '#d55181', INVESTMENT: '#199e70', OTHER: '#8b8fa3',
};

const INVESTMENT_BUCKET_ICON: Record<HoldingBucket, LucideIcon> = {
  'Mutual Funds': PieChart, Stocks: TrendingUp, Gold: Coins, 'Debt Funds': Landmark, 'Cash & Others': Wallet,
};

function accountBucket(type: AccountType): LedgerBucket {
  if (type === 'CREDIT_CARD') return 'Credit Card';
  if (type === 'INVESTMENT') return 'Investment';
  if (type === 'CASH') return 'Cash';
  return 'Bank';
}

/**
 * "All Accounts" in the reference isn't just the Account model -- it's a
 * net-worth ledger spanning real bank accounts, credit cards, investment
 * holdings, and loans (the same 4 domains "Account Breakdown" sums into
 * Bank/Investments/Loans/Cash). Each already has its own dedicated,
 * fuller-featured page; this just normalizes them into one sortable list.
 * No dedup against real Account rows of type CREDIT_CARD/INVESTMENT --
 * those are independent, uncorrelated models in this schema, same as
 * every other page in this app that lists them separately.
 */
export function buildLedger(input: {
  accounts: Account[];
  creditCards: CreditCard[];
  investments: InvestmentWithPnl[];
  loans: Loan[];
  membersById: Map<string, Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'>>;
}): LedgerRow[] {
  const rows: LedgerRow[] = [];

  for (const a of input.accounts) {
    rows.push({
      id: `account-${a.id}`,
      sourceType: 'account',
      name: a.name,
      bucket: accountBucket(a.type),
      typeLabel: ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
      institution: null,
      maskedNumber: null,
      balance: Math.abs(a.balance),
      isLiability: a.balance < 0,
      balanceLabel: a.balance < 0 ? 'Outstanding' : 'Available',
      icon: ACCOUNT_TYPE_ICON[a.type],
      color: a.color ?? ACCOUNT_TYPE_COLOR[a.type],
      member: a.memberId ? input.membersById.get(a.memberId) ?? null : null,
      account: a,
    });
  }

  for (const c of input.creditCards.filter((c) => c.isActive)) {
    rows.push({
      id: `creditCard-${c.id}`,
      sourceType: 'creditCard',
      name: c.cardName,
      bucket: 'Credit Card',
      typeLabel: 'Credit Card',
      institution: c.bank,
      maskedNumber: c.lastFourDigits ? `•••• ${c.lastFourDigits}` : null,
      balance: c.outstanding,
      isLiability: true,
      balanceLabel: 'Outstanding',
      icon: CreditCardIcon,
      color: CREDIT_CARD_BUCKET_COLOR,
      member: null, // CreditCard has no memberId in this schema
    });
  }

  for (const inv of input.investments) {
    const bucket = bucketForAssetType(inv.assetType);
    rows.push({
      id: `investment-${inv.id}`,
      sourceType: 'investment',
      name: inv.assetName,
      bucket: 'Investment',
      typeLabel: ASSET_TYPE_LABELS[inv.assetType] ?? bucket,
      institution: inv.platform,
      maskedNumber: inv.folioNumber ? `Folio ${inv.folioNumber}` : null,
      balance: inv.currentValue,
      isLiability: false,
      balanceLabel: 'Current Value',
      icon: INVESTMENT_BUCKET_ICON[bucket],
      color: BUCKET_COLORS[bucket],
      member: inv.member,
    });
  }

  for (const l of input.loans.filter((l) => l.isActive)) {
    rows.push({
      id: `loan-${l.id}`,
      sourceType: 'loan',
      name: l.name,
      bucket: 'Loan',
      typeLabel: LOAN_TYPE_LABELS[l.loanType] ?? l.loanType,
      institution: l.lender,
      maskedNumber: null,
      balance: l.remainingBalance,
      isLiability: true,
      balanceLabel: 'Outstanding',
      icon: LOAN_TYPE_ICONS[l.loanType],
      color: LOAN_TYPE_COLORS[l.loanType],
      member: l.member,
    });
  }

  return rows;
}
