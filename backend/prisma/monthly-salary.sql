-- Additive migration for existing installations (the project uses prisma db push).
-- Adds the monthly_salaries table for the home page "month sheet". Touches nothing else.
CREATE TABLE IF NOT EXISTS "monthly_salaries" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_salaries_userId_memberId_month_key" ON "monthly_salaries"("userId", "memberId", "month");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_salaries_userId_fkey') THEN
    ALTER TABLE "monthly_salaries" ADD CONSTRAINT "monthly_salaries_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_salaries_memberId_fkey') THEN
    ALTER TABLE "monthly_salaries" ADD CONSTRAINT "monthly_salaries_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
