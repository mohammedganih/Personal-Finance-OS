-- Additive migration for existing installations (the project uses prisma db push).
-- Split types for loans, bills and card EMIs; SIP pause / amount change; loan history.
-- Touches nothing else and is safe to run more than once.
ALTER TYPE "SplitEntityType" ADD VALUE IF NOT EXISTS 'LOAN';
ALTER TYPE "SplitEntityType" ADD VALUE IF NOT EXISTS 'BILL';
ALTER TYPE "SplitEntityType" ADD VALUE IF NOT EXISTS 'CARD_EMI';

ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "pauseFrom" TEXT;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "pauseUntil" TEXT;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "nextMonthlyAmount" DECIMAL(14,2);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "nextAmountFrom" TEXT;

CREATE TABLE IF NOT EXISTS "loan_events" (
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
CREATE INDEX IF NOT EXISTS "loan_events_loanId_idx" ON "loan_events"("loanId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loan_events_userId_fkey') THEN
    ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loan_events_loanId_fkey') THEN
    ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_loanId_fkey"
      FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
