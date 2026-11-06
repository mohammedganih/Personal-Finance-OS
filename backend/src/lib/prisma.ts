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
    return next(params);
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
