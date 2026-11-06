-- CreateEnum
CREATE TYPE "DuePaymentStatus" AS ENUM ('PAID', 'SKIPPED', 'AUTO');

-- CreateTable
CREATE TABLE "due_status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "dueKey" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "status" "DuePaymentStatus" NOT NULL,
    "amount" DECIMAL(14,2),
    "paidDate" TIMESTAMP(3),
    "accountId" TEXT,
    "transactionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "due_status_userId_period_idx" ON "due_status"("userId", "period");

-- CreateIndex
CREATE INDEX "due_status_itemType_itemId_idx" ON "due_status"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "due_status_userId_itemType_itemId_period_dueKey_key" ON "due_status"("userId", "itemType", "itemId", "period", "dueKey");

-- AddForeignKey
ALTER TABLE "due_status" ADD CONSTRAINT "due_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Copy every recorded decision into due_status ───────────────────────────
-- Month-plan records (loans, SIP/RD/gold, card EMIs, card bills, one-off purchases).
INSERT INTO "due_status" ("id", "userId", "itemType", "itemId", "period", "dueKey", "status", "amount", "paidDate", "accountId", "transactionIds", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, mp."userId",
       CASE mp."entityType" WHEN 'CREDIT_CARD' THEN 'CARD_STATEMENT' ELSE mp."entityType" END,
       mp."entityId", mp."month", '',
       mp."status"::text::"DuePaymentStatus", mp."amount",
       CASE WHEN mp."status" = 'PAID' THEN COALESCE((SELECT MIN(t."date") FROM "transactions" t WHERE t."id" = ANY(mp."transactionIds")), mp."createdAt") END,
       (SELECT t."accountId" FROM "transactions" t WHERE t."id" = ANY(mp."transactionIds") AND t."accountId" IS NOT NULL LIMIT 1),
       mp."transactionIds", mp."createdAt", CURRENT_TIMESTAMP
FROM "monthly_payments" mp;

-- Bill occurrences: period and dueKey from the due date in India time.
INSERT INTO "due_status" ("id", "userId", "itemType", "itemId", "period", "dueKey", "dueDate", "status", "amount", "paidDate", "accountId", "transactionIds", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, bo."userId", 'BILL', bo."billId",
       to_char((bo."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM'),
       to_char((bo."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'),
       bo."dueDate", bo."status"::text::"DuePaymentStatus", bo."amount", bo."paidDate",
       (SELECT t."accountId" FROM "transactions" t WHERE t."id" = bo."transactionId"),
       CASE WHEN bo."transactionId" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY[bo."transactionId"] END,
       bo."notes", bo."createdAt", CURRENT_TIMESTAMP
FROM "bill_occurrences" bo;
