-- Additive migration for existing installations (the project uses prisma db push).
-- Does not change balances, transactions, or existing account/payment links.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "preferredMinimum" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "credit_cards" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_cards_bankAccountId_fkey') THEN
    ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "paymentDay" INTEGER;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "paymentDay" INTEGER;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "recurringActive" BOOLEAN NOT NULL DEFAULT true;
