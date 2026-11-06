-- CreateTable
CREATE TABLE "month_close" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "combined" JSONB NOT NULL,
    "netWorth" DECIMAL(16,2) NOT NULL,
    "totalDebt" DECIMAL(16,2) NOT NULL,
    "balances" JSONB NOT NULL,
    "approximate" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_close_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "month_close_userId_month_key" ON "month_close"("userId", "month");

-- AddForeignKey
ALTER TABLE "month_close" ADD CONSTRAINT "month_close_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

