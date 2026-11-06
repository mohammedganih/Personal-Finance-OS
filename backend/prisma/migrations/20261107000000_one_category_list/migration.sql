-- AlterTable
ALTER TABLE "card_expenses" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "recurring_bills" ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── One category list ──────────────────────────────────────────────────────
-- Every free-text bill and card-purchase category becomes a Category row of the
-- household (EXPENSE), matched by name ignoring case, created when missing.
INSERT INTO "categories" ("id", "userId", "name", "type", "isDefault", "createdAt")
SELECT gen_random_uuid()::text, t."userId", t."name", 'EXPENSE', false, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("userId", lower(trim("category"))) "userId", trim("category") AS "name"
  FROM (
    SELECT "userId", "category" FROM "recurring_bills"
    UNION ALL
    SELECT "userId", "category" FROM "card_expenses"
  ) s
  WHERE "category" IS NOT NULL AND trim("category") <> ''
) t
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c
  WHERE c."userId" = t."userId" AND c."type" = 'EXPENSE' AND lower(c."name") = lower(t."name")
);

UPDATE "recurring_bills" b SET "categoryId" = (
  SELECT c."id" FROM "categories" c
  WHERE c."userId" = b."userId" AND c."type" = 'EXPENSE' AND lower(c."name") = lower(trim(b."category"))
  ORDER BY c."createdAt" LIMIT 1
);

UPDATE "card_expenses" e SET "categoryId" = (
  SELECT c."id" FROM "categories" c
  WHERE c."userId" = e."userId" AND c."type" = 'EXPENSE' AND lower(c."name") = lower(trim(e."category"))
  ORDER BY c."createdAt" LIMIT 1
)
WHERE e."category" IS NOT NULL;
