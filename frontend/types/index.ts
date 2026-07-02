// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Account ─────────────────────────────────────────────────────────────────

export type AccountType = 'SAVINGS' | 'CHECKING' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'OTHER';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  memberId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'INCOME' | 'EXPENSE';
  isDefault: boolean;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  notes: string | null;
  date: string;
  isRecurring: boolean;
  memberId: string | null;
  splitMemberId: string | null;
  splitRatio: number | null;
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'type'> | null;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  splitMember: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ─── Investment ───────────────────────────────────────────────────────────────

export type AssetType =
  | 'STOCK'
  | 'MUTUAL_FUND'
  | 'SIP'
  | 'CRYPTO'
  | 'ETF'
  | 'FIXED_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'REAL_ESTATE'
  | 'GOLD'
  | 'GOLD_SCHEME'
  | 'OTHER';

export interface Investment {
  id: string;
  assetName: string;
  assetType: AssetType;
  ticker: string | null;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  purchaseDate: string;
  exchange: string | null;
  notes: string | null;
  // SIP / MF
  monthlyAmount: number | null;
  fundCategory: string | null;
  folioNumber: string | null;
  // RD / FD / Gold Scheme
  maturityDate: string | null;
  maturityAmount: number | null;
  interestRate: number | null;
  // Common
  platform: string | null;
  memberId: string | null;
  splitMemberId: string | null;
  splitRatio: number | null;
  bankAccountId: string | null;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  splitMember: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  bankAccount: Pick<Account, 'id' | 'name' | 'type'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentWithPnl extends Investment {
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioSummary {
  portfolio: InvestmentWithPnl[];
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
  allocationByType: Record<string, number>;
}

// ─── Investment Intelligence ────────────────────────────────────────────────

export interface HoldingReturn {
  investmentId: string;
  assetName: string;
  xirr: number | null;
}

export interface AnnualizedReturns {
  overall: number | null;
  byHolding: HoldingReturn[];
}

export interface TrendPoint {
  date: string;
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
}

export interface InvestmentCalendarEntry {
  date: string;
  investmentId: string;
  assetName: string;
  assetType: AssetType;
  amount: number;
}

export type AssetClass = 'Equity' | 'Debt' | 'Gold' | 'Real Estate' | 'Crypto' | 'Other';

export interface DiversificationWarning {
  severity: 'warning' | 'info';
  message: string;
}

export interface DiversificationResult {
  classBreakdown: { assetClass: AssetClass; value: number; percentage: number }[];
  warnings: DiversificationWarning[];
}

export interface MaturityEntry {
  investmentId: string;
  assetName: string;
  assetType: AssetType;
  maturityDate: string;
  maturityAmount: number | null;
}

// ─── Goal ─────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Loan ─────────────────────────────────────────────────────────────────────

export type LoanType = 'HOME' | 'CAR' | 'PERSONAL' | 'EDUCATION' | 'BUSINESS' | 'OTHER';

export interface Loan {
  id: string;
  name: string;
  loanType: LoanType;
  principal: number;
  interestRate: number;
  emi: number;
  remainingBalance: number;
  tenureMonths: number;
  startDate: string;
  lender: string | null;
  notes: string | null;
  isActive: boolean;
  memberId: string | null;
  payerMemberId: string | null;
  bankAccountId: string | null;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  payer: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  bankAccount: Pick<Account, 'id' | 'name' | 'type'> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface Subscription {
  id: string;
  serviceName: string;
  amount: number;
  billingCycle: BillingCycle;
  renewalDate: string;
  category: string | null;
  url: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardOverview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  investmentValue: number;
  debtRatio: number;
  totalSubscriptionCost: number;
  bankBalance: number;
  monthlyLoanEMI: number;
  monthlyCardEMI: number;
  totalMonthlyEMI: number;
  remainingSafeToSave: number;
  monthlyInvestmentCommitment: number;
  actualInvestmentSpent: number;
  actualSubscriptionSpent: number;
  actualEMISpent: number;
  otherExpenses: number;
  effectiveSubscriptionSpent: number;
  effectiveInvestmentSpent: number;
  effectiveEMISpent: number;
}

export interface CashflowData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  color: string;
  icon: string;
  total: number;
  percentage: number;
  count: number;
}

export interface QuickInsight {
  type: 'increase' | 'decrease' | 'neutral' | 'positive';
  message: string;
  icon: string;
}

// ─── Family Member ────────────────────────────────────────────────────────────

export interface FamilyMember {
  id:        string;
  userId:    string;
  name:      string;
  relation:  string | null;
  color:     string | null;
  emoji:     string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberSplit {
  member:          FamilyMember;
  monthlyIncome:   number;
  monthlyExpenses: number;
  monthlySavings:  number;
  totalIncome:     number;
  totalExpenses:   number;
  loanOwed:        number;
  monthlyEMI:      number;
  investmentValue: number;
}

export interface MemberAnalytics {
  breakdown:           MemberSplit[];
  unassignedIncome:    number;
  unassignedExpenses:  number;
}


// ─── Card EMI ─────────────────────────────────────────────────────────────────

export interface CardEMI {
  id: string;
  userId: string;
  creditCardId: string;
  itemName: string;
  totalAmount: number;
  emiAmount: number;
  tenureMonths: number;
  emisPaid: number;
  isNoCost: boolean;
  interestRate: number | null;
  startDate: string;
  notes: string | null;
  isArchived: boolean;
  // computed by backend
  outstanding: number;
  emisRemaining: number;
  progressPct: number;
  creditCard?: { id: string; cardName: string; bank: string | null; lastFourDigits: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface CardEMISummary {
  monthlyBurden: number;
  totalOutstanding: number;
  count: number;
}

// ─── Credit Card ──────────────────────────────────────────────────────────────

export interface CreditCard {
  id: string;
  cardName: string;
  bank: string | null;
  lastFourDigits: string | null;
  creditLimit: number;
  outstanding: number;
  minimumPayment: number | null;
  dueDate: string;
  statementDate: string | null;
  interestRate: number | null;
  color: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── P2P ──────────────────────────────────────────────────────────────────────

export type P2PType = 'LENT' | 'BORROWED';

export interface P2PLoan {
  id: string;
  personName: string;
  type: P2PType;
  amount: number;
  remainingAmount: number;
  date: string;
  dueDate: string | null;
  description: string | null;
  notes: string | null;
  isSettled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface P2PSummary {
  totalLent: number;
  totalBorrowed: number;
  net: number;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export type BudgetStatus = 'under' | 'near' | 'over';

export interface Budget {
  id: string;
  categoryId: string;
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
  monthlyLimit: number;
  // computed by backend, current calendar month
  spent: number;
  remaining: number;
  progressPct: number;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Debt Intelligence ────────────────────────────────────────────────────────

export type DebtSourceType = 'LOAN' | 'CREDIT_CARD' | 'CARD_EMI';

export interface UnifiedDebt {
  id: string;
  sourceType: DebtSourceType;
  sourceId: string;
  name: string;
  remainingBalance: number;
  emi: number;
  interestRate: number;
  memberId: string | null;
  monthlyInterest: number;
  monthlyPrincipal: number;
  monthsToPayoff: number;
}

export type HealthScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface HealthScoreFactor {
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface HealthScoreResult {
  score: number;
  band: HealthScoreBand;
  factors: HealthScoreFactor[];
}

export interface DebtStrategy {
  debts: UnifiedDebt[];
  avalancheOrder: string[];
  snowballOrder: string[];
  totalMonthlyInterest: number;
  extraPayment: number;
  baseMonths: number;
  avalancheMonthsWithExtra: number;
  snowballMonthsWithExtra: number;
  interestSavedAvalanche: number;
  interestSavedSnowball: number;
  bestStrategy: 'avalanche' | 'snowball';
  totalInterestSaved: number;
}

export interface PrepaymentResult {
  debtId: string;
  name: string;
  lumpSum: number;
  baselineMonths: number;
  baselineInterest: number;
  newMonths: number;
  newInterest: number;
  monthsSaved: number;
  interestSaved: number;
}

export interface CalendarEntry {
  date: string;
  debtId: string;
  sourceType: DebtSourceType;
  name: string;
  amount: number;
}

export type RecommendationSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface Recommendation {
  priority: number;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  debtId?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
