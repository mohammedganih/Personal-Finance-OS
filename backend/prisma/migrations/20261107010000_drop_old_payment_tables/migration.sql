-- due_status (20261106030000) replaced these two tables; every row was copied
-- there and nothing reads them any more.
ALTER TABLE "bill_occurrences" DROP CONSTRAINT "bill_occurrences_billId_fkey";
ALTER TABLE "bill_occurrences" DROP CONSTRAINT "bill_occurrences_userId_fkey";
ALTER TABLE "monthly_payments" DROP CONSTRAINT "monthly_payments_userId_fkey";
DROP TABLE "bill_occurrences";
DROP TABLE "monthly_payments";
DROP TYPE "BillOccurrenceStatus";

-- When an investment's units or price (NAV) last changed, for the Health check.
ALTER TABLE "investments" ADD COLUMN "priceUpdatedAt" TIMESTAMP(3);
-- Best guess for existing holdings: the last time the row changed at all.
UPDATE "investments" SET "priceUpdatedAt" = "updatedAt";
