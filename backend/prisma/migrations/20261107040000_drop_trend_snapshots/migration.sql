-- The debt and investment trend snapshots fed charts on the old Analytics
-- page; nothing writes or reads them since round 5.
ALTER TABLE "debt_snapshots" DROP CONSTRAINT "debt_snapshots_userId_fkey";
ALTER TABLE "investment_snapshots" DROP CONSTRAINT "investment_snapshots_userId_fkey";
DROP TABLE "debt_snapshots";
DROP TABLE "investment_snapshots";
