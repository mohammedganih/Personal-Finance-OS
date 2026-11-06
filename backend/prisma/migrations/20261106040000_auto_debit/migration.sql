-- AlterTable
ALTER TABLE "card_emis" ADD COLUMN     "autoDebit" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "autoDebit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "autoDebit" BOOLEAN NOT NULL DEFAULT true;


-- Recurring deposits are debited by the bank, so they start as auto-debited.
UPDATE "investments" SET "autoDebit" = true WHERE "assetType" = 'RECURRING_DEPOSIT';
