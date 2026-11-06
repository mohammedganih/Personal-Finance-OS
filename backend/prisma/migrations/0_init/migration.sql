-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'MUTUAL_FUND', 'SIP', 'CRYPTO', 'ETF', 'FIXED_DEPOSIT', 'RECURRING_DEPOSIT', 'REAL_ESTATE', 'GOLD', 'GOLD_SCHEME', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('HOME', 'CAR', 'PERSONAL', 'EDUCATION', 'BUSINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "P2PType" AS ENUM ('LENT', 'BORROWED');

-- CreateEnum
CREATE TYPE "BillFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'EVERY_2_MONTHS', 'QUARTERLY', 'EVERY_4_MONTHS', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillOccurrenceStatus" AS ENUM ('PAID', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('FARM_HOUSE', 'EMERGENCY_FUND', 'RELOCATION', 'CAR_PURCHASE', 'RETIREMENT', 'TRAVEL', 'EDUCATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "GoalRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('RECURRING', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "SplitEntityType" AS ENUM ('TRANSACTION', 'INVESTMENT', 'LOAN', 'BILL', 'CARD_EMI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "color" TEXT,
    "emoji" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "preferredMinimum" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "type" "TransactionType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "categoryId" TEXT,
    "memberId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isWealthTransfer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "paymentDay" INTEGER,
    "recurringActive" BOOLEAN NOT NULL DEFAULT true,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "ticker" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "buyPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "exchange" TEXT,
    "notes" TEXT,
    "monthlyAmount" DECIMAL(14,2),
    "fundCategory" TEXT,
    "folioNumber" TEXT,
    "maturityDate" TIMESTAMP(3),
    "maturityAmount" DECIMAL(14,2),
    "interestRate" DECIMAL(5,2),
    "platform" TEXT,
    "pauseFrom" TEXT,
    "pauseUntil" TEXT,
    "nextMonthlyAmount" DECIMAL(14,2),
    "nextAmountFrom" TEXT,
    "memberId" TEXT,
    "bankAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_collateral" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "address" TEXT,
    "ownershipPercent" DECIMAL(5,2),
    "expectedAppreciationRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "goalType" "GoalType" NOT NULL DEFAULT 'CUSTOM',
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "currentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "monthlyContribution" DECIMAL(14,2),
    "expectedReturnRate" DECIMAL(5,2),
    "expectedInflationRate" DECIMAL(5,2),
    "riskLevel" "GoalRiskLevel",
    "fundingAccountId" TEXT,
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ContributionType" NOT NULL DEFAULT 'ONE_TIME',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "paymentDay" INTEGER,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "payerMemberId" TEXT,
    "bankAccountId" TEXT,
    "linkedInvestmentId" TEXT,
    "name" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "emi" DECIMAL(14,2) NOT NULL,
    "remainingBalance" DECIMAL(14,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "lender" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "icon" TEXT,
    "color" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "frequency" "BillFrequency" NOT NULL DEFAULT 'MONTHLY',
    "customIntervalDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "autoDebit" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "accountId" TEXT,
    "creditCardId" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedUntil" TIMESTAMP(3),
    "url" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_occurrences" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "BillOccurrenceStatus" NOT NULL,
    "amount" DECIMAL(12,2),
    "paidDate" TIMESTAMP(3),
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "bankAccountId" TEXT,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "cardName" TEXT NOT NULL,
    "bank" TEXT,
    "lastFourDigits" TEXT,
    "creditLimit" DECIMAL(12,2) NOT NULL,
    "outstanding" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumPayment" DECIMAL(10,2),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "statementDate" TIMESTAMP(3),
    "interestRate" DECIMAL(5,2),
    "color" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_emis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "memberId" TEXT,
    "itemName" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "emiAmount" DECIMAL(10,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "emisPaid" INTEGER NOT NULL DEFAULT 0,
    "isNoCost" BOOLEAN NOT NULL DEFAULT true,
    "interestRate" DECIMAL(5,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_emis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "personName" TEXT NOT NULL,
    "type" "P2PType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalInvested" DECIMAL(14,2) NOT NULL,
    "totalCurrent" DECIMAL(14,2) NOT NULL,
    "totalPnl" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "net_worth_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "netWorth" DECIMAL(14,2) NOT NULL,
    "totalAssets" DECIMAL(14,2) NOT NULL,
    "totalLiabilities" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalOutstanding" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "monthlyLimit" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_splits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "SplitEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "secondaryMemberId" TEXT NOT NULL,
    "ratio" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownership_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "BillOccurrenceStatus" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "transactionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_salaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2),
    "balanceBefore" DECIMAL(14,2),
    "balanceAfter" DECIMAL(14,2),
    "oldRate" DECIMAL(5,2),
    "newRate" DECIMAL(5,2),
    "oldEmi" DECIMAL(14,2),
    "newEmi" DECIMAL(14,2),
    "accountId" TEXT,
    "transactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_statements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalDue" DECIMAL(12,2) NOT NULL,
    "minimumDue" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_expenses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "statementMonth" TEXT NOT NULL,
    "linkedType" TEXT,
    "linkedId" TEXT,
    "paidDate" TIMESTAMP(3),
    "paidFromAccountId" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "family_members_userId_idx" ON "family_members"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_memberId_idx" ON "accounts"("memberId");

-- CreateIndex
CREATE INDEX "categories_userId_idx" ON "categories"("userId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date");

-- CreateIndex
CREATE INDEX "transactions_userId_type_idx" ON "transactions"("userId", "type");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transactions_memberId_idx" ON "transactions"("memberId");

-- CreateIndex
CREATE INDEX "investments_userId_idx" ON "investments"("userId");

-- CreateIndex
CREATE INDEX "investments_userId_assetType_idx" ON "investments"("userId", "assetType");

-- CreateIndex
CREATE INDEX "investments_memberId_idx" ON "investments"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "investment_collateral_investmentId_key" ON "investment_collateral"("investmentId");

-- CreateIndex
CREATE INDEX "goals_userId_idx" ON "goals"("userId");

-- CreateIndex
CREATE INDEX "goals_memberId_idx" ON "goals"("memberId");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_idx" ON "goal_contributions"("goalId");

-- CreateIndex
CREATE INDEX "goal_contributions_userId_idx" ON "goal_contributions"("userId");

-- CreateIndex
CREATE INDEX "loans_userId_idx" ON "loans"("userId");

-- CreateIndex
CREATE INDEX "loans_memberId_idx" ON "loans"("memberId");

-- CreateIndex
CREATE INDEX "loans_linkedInvestmentId_idx" ON "loans"("linkedInvestmentId");

-- CreateIndex
CREATE INDEX "recurring_bills_userId_idx" ON "recurring_bills"("userId");

-- CreateIndex
CREATE INDEX "recurring_bills_userId_status_idx" ON "recurring_bills"("userId", "status");

-- CreateIndex
CREATE INDEX "recurring_bills_userId_category_idx" ON "recurring_bills"("userId", "category");

-- CreateIndex
CREATE INDEX "recurring_bills_memberId_idx" ON "recurring_bills"("memberId");

-- CreateIndex
CREATE INDEX "bill_occurrences_userId_dueDate_idx" ON "bill_occurrences"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "bill_occurrences_billId_idx" ON "bill_occurrences"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_occurrences_billId_dueDate_key" ON "bill_occurrences"("billId", "dueDate");

-- CreateIndex
CREATE INDEX "credit_cards_userId_idx" ON "credit_cards"("userId");

-- CreateIndex
CREATE INDEX "card_emis_userId_idx" ON "card_emis"("userId");

-- CreateIndex
CREATE INDEX "card_emis_creditCardId_idx" ON "card_emis"("creditCardId");

-- CreateIndex
CREATE INDEX "card_emis_memberId_idx" ON "card_emis"("memberId");

-- CreateIndex
CREATE INDEX "p2p_loans_userId_idx" ON "p2p_loans"("userId");

-- CreateIndex
CREATE INDEX "p2p_loans_memberId_idx" ON "p2p_loans"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "investment_snapshots_userId_idx" ON "investment_snapshots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investment_snapshots_userId_date_key" ON "investment_snapshots"("userId", "date");

-- CreateIndex
CREATE INDEX "net_worth_snapshots_userId_idx" ON "net_worth_snapshots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "net_worth_snapshots_userId_date_key" ON "net_worth_snapshots"("userId", "date");

-- CreateIndex
CREATE INDEX "debt_snapshots_userId_idx" ON "debt_snapshots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "debt_snapshots_userId_date_key" ON "debt_snapshots"("userId", "date");

-- CreateIndex
CREATE INDEX "budgets_userId_idx" ON "budgets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_userId_categoryId_key" ON "budgets"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "ownership_splits_userId_idx" ON "ownership_splits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_splits_entityType_entityId_key" ON "ownership_splits"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "monthly_payments_userId_month_idx" ON "monthly_payments"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_payments_userId_entityType_entityId_month_key" ON "monthly_payments"("userId", "entityType", "entityId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_salaries_userId_memberId_month_key" ON "monthly_salaries"("userId", "memberId", "month");

-- CreateIndex
CREATE INDEX "loan_events_loanId_idx" ON "loan_events"("loanId");

-- CreateIndex
CREATE INDEX "card_statements_userId_idx" ON "card_statements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "card_statements_creditCardId_month_key" ON "card_statements"("creditCardId", "month");

-- CreateIndex
CREATE INDEX "card_expenses_userId_idx" ON "card_expenses"("userId");

-- CreateIndex
CREATE INDEX "card_expenses_creditCardId_statementMonth_idx" ON "card_expenses"("creditCardId", "statementMonth");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_collateral" ADD CONSTRAINT "investment_collateral_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_fundingAccountId_fkey" FOREIGN KEY ("fundingAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_payerMemberId_fkey" FOREIGN KEY ("payerMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_linkedInvestmentId_fkey" FOREIGN KEY ("linkedInvestmentId") REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_billId_fkey" FOREIGN KEY ("billId") REFERENCES "recurring_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_emis" ADD CONSTRAINT "card_emis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_emis" ADD CONSTRAINT "card_emis_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_emis" ADD CONSTRAINT "card_emis_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_loans" ADD CONSTRAINT "p2p_loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_loans" ADD CONSTRAINT "p2p_loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_snapshots" ADD CONSTRAINT "debt_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_splits" ADD CONSTRAINT "ownership_splits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_splits" ADD CONSTRAINT "ownership_splits_secondaryMemberId_fkey" FOREIGN KEY ("secondaryMemberId") REFERENCES "family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "monthly_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_salaries" ADD CONSTRAINT "monthly_salaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_salaries" ADD CONSTRAINT "monthly_salaries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

