-- Additive migration for existing installations (the project uses prisma db push).
-- Adds card_statements (monthly statement records) and card_expenses (one-off
-- card purchases). Touches nothing else and is safe to run more than once.
CREATE TABLE IF NOT EXISTS "card_statements" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "card_statements_creditCardId_month_key" ON "card_statements"("creditCardId", "month");
CREATE INDEX IF NOT EXISTS "card_statements_userId_idx" ON "card_statements"("userId");

CREATE TABLE IF NOT EXISTS "card_expenses" (
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
CREATE INDEX IF NOT EXISTS "card_expenses_userId_idx" ON "card_expenses"("userId");
CREATE INDEX IF NOT EXISTS "card_expenses_creditCardId_statementMonth_idx" ON "card_expenses"("creditCardId", "statementMonth");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_statements_userId_fkey') THEN
    ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_statements_creditCardId_fkey') THEN
    ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_creditCardId_fkey"
      FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_expenses_userId_fkey') THEN
    ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_expenses_creditCardId_fkey') THEN
    ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_creditCardId_fkey"
      FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_expenses_memberId_fkey') THEN
    ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
