-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'SPEND', 'TRANSFER', 'SAVE', 'DEBT', 'ADJUST');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "kind" "TransactionKind" NOT NULL DEFAULT 'SPEND',
ADD COLUMN     "period" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "transferGroupId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_userId_kind_date_idx" ON "transactions"("userId", "kind", "date");

-- CreateIndex
CREATE INDEX "transactions_sourceType_sourceId_idx" ON "transactions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "transactions_transferGroupId_idx" ON "transactions"("transferGroupId");


-- ─── Backfill: what each existing entry was for ─────────────────────────────
-- Months are worked out in India time, like the rest of the app.

-- 1. Where each entry came from (sourceType / sourceId / period).
-- Scheduled payments (loans, SIP/RD/gold, card EMIs, card bills, one-off investment purchases).
UPDATE "transactions" t
SET "sourceType" = CASE WHEN mp."entityType" = 'INVESTMENT_PURCHASE' THEN 'INVESTMENT' ELSE mp."entityType" END,
    "sourceId"   = mp."entityId",
    "period"     = CASE WHEN mp."month" ~ '^[0-9]{4}-[0-9]{2}$' THEN mp."month" END
FROM "monthly_payments" mp
WHERE t."id" = ANY(mp."transactionIds") AND t."userId" = mp."userId";

-- Bill payments.
UPDATE "transactions" t
SET "sourceType" = 'BILL', "sourceId" = bo."billId",
    "period" = to_char((bo."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
FROM "bill_occurrences" bo
WHERE bo."transactionId" = t."id";

-- Card purchases paid off from a bank account straight away.
UPDATE "transactions" t
SET "sourceType" = 'CARD_EXPENSE', "sourceId" = ce."id", "period" = ce."statementMonth"
FROM "card_expenses" ce
WHERE ce."transactionId" = t."id";

-- Loan prepayments.
UPDATE "transactions" t
SET "sourceType" = 'LOAN_EVENT', "sourceId" = le."id",
    "period" = to_char((le."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
FROM "loan_events" le
WHERE le."transactionId" = t."id";

-- 2. Kind. Everything starts as SPEND (the column default), including bills and the card bill.
UPDATE "transactions" SET "kind" = 'INCOME' WHERE "type" = 'INCOME';

-- Investment instalments and purchases are saving, not spending.
UPDATE "transactions" t SET "kind" = 'SAVE'
WHERE t."type" = 'EXPENSE' AND (
  t."sourceType" = 'INVESTMENT'
  OR t."categoryId" IN (SELECT "id" FROM "categories" WHERE "name" = 'Investment')
);

-- Loan EMIs, card EMIs and prepayments are debt repayment.
UPDATE "transactions" t SET "kind" = 'DEBT'
WHERE t."type" = 'EXPENSE' AND t."kind" = 'SPEND' AND (
  t."sourceType" IN ('LOAN', 'CARD_EMI', 'LOAN_EVENT')
  OR t."isWealthTransfer"
  OR t."categoryId" IN (SELECT "id" FROM "categories" WHERE "name" IN ('Loan EMI', 'Card EMI', 'Wealth Creation'))
);
