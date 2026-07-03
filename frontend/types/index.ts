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
  isWealthTransfer: boolean;
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
  | 'VEHICLE'
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
  // Collateral assets (Real Estate / Vehicle) -- may back a Loan
  address: string | null;
  ownershipPercent: number | null;
  expectedAppreciationRate: number | null;
  linkedLoans?: Pick<Loan, 'id' | 'name' | 'remainingBalance' | 'interestRate' | 'emi' | 'startDate' | 'tenureMonths' | 'principal'>[];
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

export type GoalType = 'FARM_HOUSE' | 'EMERGENCY_FUND' | 'RELOCATION' | 'CAR_PURCHASE' | 'RETIREMENT' | 'TRAVEL' | 'EDUCATION' | 'CUSTOM';
export type GoalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type GoalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
export type ContributionType = 'RECURRING' | 'ONE_TIME';

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  goalType: GoalType;
  priority: GoalPriority;
  status: GoalStatus;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyContribution: number | null;
  expectedReturnRate: number | null;
  expectedInflationRate: number | null;
  riskLevel: GoalRiskLevel | null;
  fundingAccountId: string | null;
  memberId: string | null;
  notes: string | null;
  isCompleted: boolean;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  fundingAccount: Pick<Account, 'id' | 'name' | 'type'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  type: ContributionType;
  notes: string | null;
  createdAt: string;
}

// ─── Goal Intelligence ──────────────────────────────────────────────────────

export interface GoalProgress {
  currentPct: number;
  remainingAmount: number;
  monthsLeft: number;
  requiredMonthlySavings: number;
  requiredWeeklySavings: number;
  requiredDailySavings: number;
  requiredAnnualSavings: number;
  currentMonthlySavings: number;
  savingsGap: number;
  averageMonthlyContribution: number;
  contributionTrend: 'increasing' | 'decreasing' | 'flat' | 'insufficient_data';
  expectedFinishDate: string | null;
  projectedFutureValue: number;
  inflationAdjustedGoalValue: number;
  realPurchasingPower: number;
}

export type GoalProbabilityBand = 'Very Safe' | 'On Track' | 'Moderate Risk' | 'High Risk' | 'Unlikely';

export interface GoalProbabilityFactor {
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface GoalProbability {
  score: number;
  band: GoalProbabilityBand;
  color: string;
  factors: GoalProbabilityFactor[];
}

export interface GoalScenario {
  name: string;
  description: string;
  completionDate: string | null;
  monthlySavingNeeded: number;
  probability: number;
  totalContributions: number;
  investmentGrowth: number;
  inflationImpact: number;
}

export interface GoalMilestone {
  percentage: number;
  achieved: boolean;
  achievedAt: string | null;
  amountAtMilestone: number;
}

export type GoalRecommendationSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface GoalRecommendation {
  priority: number;
  severity: GoalRecommendationSeverity;
  title: string;
  description: string;
}

export interface GoalInsight {
  goalId: string;
  goalName: string;
  message: string;
  severity: GoalRecommendationSeverity;
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
  linkedInvestmentId: string | null;
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  payer: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  bankAccount: Pick<Account, 'id' | 'name' | 'type'> | null;
  linkedInvestment: Pick<Investment, 'id' | 'assetName' | 'assetType' | 'currentPrice' | 'ownershipPercent'> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Asset-Loan Intelligence ────────────────────────────────────────────────

export interface AmortizationRow {
  month: number;
  date: string;
  openingBalance: number;
  interest: number;
  principal: number;
  closingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface AssetLoanSummary {
  loanId: string;
  investmentId: string;
  assetName: string;
  assetType: AssetType;
  currentPropertyValue: number;
  purchasePrice: number;
  originalLoanAmount: number;
  remainingBalance: number;
  ownershipPercent: number;
  equity: number;
  unrealizedGain: number;
  loanToValue: number;
  principalPaid: number;
  interestPaid: number;
  totalInterestRemaining: number;
  monthsElapsed: number;
  roi: number;
  appreciationSincePurchasePct: number;
  annualizedAppreciationPct: number;
  projectedValueNextYear: number;
  principalPaidThisMonth: number;
  interestPaidThisMonth: number;
  interestShareOfEMIPct: number;
}

export type AssetLoanInsightSeverity = 'positive' | 'info' | 'warning';

export interface AssetLoanInsight {
  severity: AssetLoanInsightSeverity;
  message: string;
  loanId: string;
}

export interface HomeEquitySummary {
  assets: AssetLoanSummary[];
  totalEquity: number;
  totalPropertyValue: number;
  totalOutstanding: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  weightedLTV: number;
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
  monthlyWealthCreation: number;
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

export type FundingSourceType = 'MATURITY' | 'LIQUID_HOLDING';

export interface FundingOpportunity {
  sourceType: FundingSourceType;
  investmentId: string;
  assetName: string;
  assetType: AssetType;
  availableAmount: number;
  availableDate: string | null;
  targetDebtId: string;
  targetDebtName: string;
  monthsSaved: number;
  interestSaved: number;
  newMonths: number;
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
