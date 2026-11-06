-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;


-- Backfill: opening balance = today's balance + principal already repaid through
-- recorded EMIs and prepayments, so every loan's balance comes out unchanged.
UPDATE "loans" l
SET "openingBalance" = l."remainingBalance"
  + COALESCE((SELECT SUM(t."amount") FROM "transactions" t
              WHERE t."sourceType" = 'LOAN' AND t."sourceId" = l."id" AND t."description" LIKE 'EMI Principal%'), 0)
  + COALESCE((SELECT SUM(e."amount") FROM "loan_events" e
              WHERE e."loanId" = l."id" AND e."type" = 'PREPAYMENT'), 0);
