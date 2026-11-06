-- AlterTable
ALTER TABLE "monthly_salaries" ADD COLUMN     "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "monthly_salaries" ADD CONSTRAINT "monthly_salaries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Backfill: link saved salaries to the salary already typed by hand ──────
-- A saved salary whose person has exactly one hand-typed INCOME entry in the
-- Salary category that month (India time) adopts it: the entry becomes the
-- salary's ledger entry and its account becomes the salary's account. Amounts
-- are left as they are; saving the salary again brings the entry in line.
CREATE TEMP TABLE salary_match AS
SELECT s."id" AS salary_id, t."id" AS txn_id, s."month",
       count(*) OVER (PARTITION BY s."id") AS per_salary,
       count(*) OVER (PARTITION BY t."id") AS per_txn
FROM "monthly_salaries" s
JOIN "transactions" t
  ON t."userId" = s."userId" AND t."memberId" = s."memberId"
 AND t."type" = 'INCOME' AND t."sourceType" IS NULL AND t."transferGroupId" IS NULL
 AND to_char((t."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = s."month"
JOIN "categories" c ON c."id" = t."categoryId" AND c."name" = 'Salary';

UPDATE "transactions" t
SET "sourceType" = 'SALARY', "sourceId" = m.salary_id, "period" = m."month", "kind" = 'INCOME'
FROM salary_match m
WHERE t."id" = m.txn_id AND m.per_salary = 1 AND m.per_txn = 1;

UPDATE "monthly_salaries" s
SET "accountId" = t."accountId"
FROM "transactions" t
WHERE t."sourceType" = 'SALARY' AND t."sourceId" = s."id";

DROP TABLE salary_match;
