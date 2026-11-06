import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type TxnData = { type?: string; kind?: string };
/** A ledger row written without a kind gets one from its type (income → INCOME, expense → SPEND). */
function fillKind(data: unknown) {
  for (const row of Array.isArray(data) ? data : [data]) {
    const t = row as TxnData | undefined;
    if (t && t.kind === undefined && t.type) t.kind = t.type === 'INCOME' ? 'INCOME' : 'SPEND';
  }
}

function fillOpeningBalance(data: unknown) {
  for (const row of Array.isArray(data) ? data : [data]) {
    const l = row as { remainingBalance?: unknown; openingBalance?: unknown } | undefined;
    if (l && l.openingBalance === undefined && l.remainingBalance !== undefined) l.openingBalance = l.remainingBalance;
  }
}

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  // Safety net for the ledger: the column default is SPEND, which would be
  // wrong for income written by a caller that forgets `kind`.
  client.$use(async (params, next) => {
    if (params.model === 'Transaction') {
      if (params.action === 'create' || params.action === 'createMany') fillKind(params.args?.data);
      if (params.action === 'upsert') fillKind(params.args?.create);
    }
    // A loan's balance is derived from its opening balance, which starts as the balance entered.
    if (params.model === 'Loan' && (params.action === 'create' || params.action === 'createMany')) fillOpeningBalance(params.args?.data);
    return next(params);
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
