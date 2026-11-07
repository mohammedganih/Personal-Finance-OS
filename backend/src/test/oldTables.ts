import { prisma } from '../lib/prisma';

// The monthly_payments and bill_occurrences tables were dropped once due_status
// replaced them. Tests of the older migrations that copied data out of them
// recreate just the columns those migrations read, and drop them afterwards.

export interface OldMonthlyPayment {
  userId: string; entityType: string; entityId: string; month: string;
  status: 'PAID' | 'SKIPPED'; amount: number; transactionIds?: string[];
}
export interface OldBillOccurrence {
  userId: string; billId: string; dueDate: Date; status: 'PAID' | 'SKIPPED';
  amount?: number; paidDate?: Date; transactionId?: string; notes?: string;
}

export async function createOldTables() {
  await dropOldTables();
  await prisma.$executeRawUnsafe(`CREATE TABLE "monthly_payments" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "month" TEXT NOT NULL,
    "status" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
    "transactionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "bill_occurrences" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "billId" TEXT NOT NULL, "userId" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL,
    "amount" DECIMAL(12,2), "paidDate" TIMESTAMP(3), "transactionId" TEXT, "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

export async function dropOldTables() {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "monthly_payments"');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "bill_occurrences"');
}

export async function insertMonthlyPayments(rows: OldMonthlyPayment[]) {
  for (const r of rows) {
    await prisma.$executeRaw`INSERT INTO "monthly_payments" ("userId", "entityType", "entityId", "month", "status", "amount", "transactionIds")
      VALUES (${r.userId}, ${r.entityType}, ${r.entityId}, ${r.month}, ${r.status}, ${r.amount}, ${r.transactionIds ?? []}::text[])`;
  }
}

export async function insertBillOccurrences(rows: OldBillOccurrence[]) {
  for (const r of rows) {
    await prisma.$executeRaw`INSERT INTO "bill_occurrences" ("userId", "billId", "dueDate", "status", "amount", "paidDate", "transactionId", "notes")
      VALUES (${r.userId}, ${r.billId}, ${r.dueDate}, ${r.status}, ${r.amount ?? null}, ${r.paidDate ?? null}, ${r.transactionId ?? null}, ${r.notes ?? null})`;
  }
}
