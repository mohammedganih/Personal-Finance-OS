import { CardEMI, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateCardEMIInput, UpdateCardEMIInput } from '../validators/card-emi.validator';
import { findCategory } from '../lib/paymentCategory';
import { balanceAdjustment } from '../lib/accountBalance';

// ── Core calculation ──────────────────────────────────────────────────────────
export function calcEMIOutstanding(emi: {
  isNoCost: boolean;
  interestRate: unknown;
  totalAmount: unknown;
  emiAmount: unknown;
  tenureMonths: number;
  emisPaid: number;
}): number {
  const emisRemaining = Math.max(0, emi.tenureMonths - emi.emisPaid);
  if (emisRemaining === 0) return 0;

  const emiAmt = Number(emi.emiAmount);

  if (emi.isNoCost || !emi.interestRate) {
    // No-cost EMI: outstanding is purely remaining installments × EMI
    return emiAmt * emisRemaining;
  }

  // Interest-bearing: use reverse amortization from payments made
  // Remaining balance = P(1+r)^n − EMI × [(1+r)^n − 1] / r
  const r = Number(emi.interestRate) / 100 / 12;
  const P = Number(emi.totalAmount);
  const n = emi.emisPaid;

  if (r <= 0) return emiAmt * emisRemaining;

  const remaining = P * Math.pow(1 + r, n) - emiAmt * (Math.pow(1 + r, n) - 1) / r;
  return Math.max(0, remaining);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function getCardEMIs(userId: string, includeArchived = false) {
  const emis = await prisma.cardEMI.findMany({
    where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
    orderBy: [{ isArchived: 'asc' }, { startDate: 'desc' }],
  });

  return emis.map(serializeWithStats);
}

export async function getCardEMIsForCard(userId: string, creditCardId: string) {
  const emis = await prisma.cardEMI.findMany({
    where: { userId, creditCardId, isArchived: false },
    orderBy: { startDate: 'desc' },
  });
  return emis.map(serializeWithStats);
}

export async function createCardEMI(userId: string, input: CreateCardEMIInput) {
  // Verify the card belongs to this user
  const card = await prisma.creditCard.findFirst({ where: { id: input.creditCardId, userId } });
  if (!card) throw createError('Credit card not found', 404);

  const emi = await prisma.cardEMI.create({
    data: {
      userId,
      creditCardId: input.creditCardId,
      itemName:     input.itemName,
      totalAmount:  input.totalAmount,
      emiAmount:    input.emiAmount,
      tenureMonths: input.tenureMonths,
      emisPaid:     input.emisPaid ?? 0,
      isNoCost:     input.isNoCost ?? true,
      interestRate: input.interestRate,
      startDate:    new Date(input.startDate),
      notes:        input.notes,
    },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
  });

  return serializeWithStats(emi);
}

export async function updateCardEMI(userId: string, id: string, input: UpdateCardEMIInput) {
  const existing = await prisma.cardEMI.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card EMI not found', 404);

  // Auto-archive when fully paid
  const emisPaid    = input.emisPaid ?? existing.emisPaid;
  const tenure      = input.tenureMonths ?? existing.tenureMonths;
  const autoArchive = emisPaid >= tenure;

  const emi = await prisma.cardEMI.update({
    where: { id },
    data: {
      ...(input.itemName     !== undefined && { itemName: input.itemName }),
      ...(input.totalAmount  !== undefined && { totalAmount: input.totalAmount }),
      ...(input.emiAmount    !== undefined && { emiAmount: input.emiAmount }),
      ...(input.tenureMonths !== undefined && { tenureMonths: input.tenureMonths }),
      ...(input.emisPaid     !== undefined && { emisPaid: input.emisPaid }),
      ...(input.isNoCost     !== undefined && { isNoCost: input.isNoCost }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate }),
      ...(input.startDate    !== undefined && { startDate: new Date(input.startDate) }),
      ...(input.notes        !== undefined && { notes: input.notes }),
      isArchived: input.isArchived ?? autoArchive,
    },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
  });

  return serializeWithStats(emi);
}

export async function deleteCardEMI(userId: string, id: string) {
  const existing = await prisma.cardEMI.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card EMI not found', 404);
  await prisma.cardEMI.delete({ where: { id } });
}

export async function payCardEMI(userId: string, emiId: string, accountId?: string) {
  const emi = await prisma.cardEMI.findFirst({ where: { id: emiId, userId, isArchived: false } });
  if (!emi) throw createError('Card EMI not found or already completed', 404);

  if (emi.emisPaid >= emi.tenureMonths) {
    throw createError('All instalments for this EMI are already paid', 400);
  }

  const newEmisPaid = emi.emisPaid + 1;
  const isComplete  = newEmisPaid >= emi.tenureMonths;
  const categoryId  = await findCategory(userId, 'Card EMI');

  const emiAmount = Number(emi.emiAmount);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.cardEMI.update({
      where: { id: emiId },
      data: {
        emisPaid:   newEmisPaid,
        isArchived: isComplete,
      },
      include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      emiAmount,
        description: `Card EMI: ${emi.itemName} (${newEmisPaid}/${emi.tenureMonths})`,
        date:        new Date(),
        categoryId:  categoryId ?? undefined,
        accountId:   accountId  ?? undefined,
        isRecurring: true,
      },
    }),
  ];

  // Paying a card EMI instalment from a bank account draws down that account's balance too.
  if (accountId) ops.push(balanceAdjustment(accountId, -emiAmount));

  const [updatedEMI, transaction] = await prisma.$transaction(ops);
  const txn = transaction as { amount: { toString(): string } };

  return {
    emi:         serializeWithStats(updatedEMI as CardEMI & { creditCard?: { id: string; cardName: string; bank: string | null; lastFourDigits: string | null } }),
    transaction: { ...txn, amount: Number(txn.amount) },
    isComplete,
  };
}

// ── Summary for dashboard ─────────────────────────────────────────────────────
export async function getCardEMISummary(userId: string) {
  const emis = await prisma.cardEMI.findMany({
    where: { userId, isArchived: false },
  });

  const monthlyBurden = emis.reduce((s, e) => s + Number(e.emiAmount), 0);
  const totalOutstanding = emis.reduce((s, e) => s + calcEMIOutstanding(e), 0);

  return { monthlyBurden, totalOutstanding, count: emis.length };
}

// ── Serializer ────────────────────────────────────────────────────────────────
function serializeWithStats(emi: CardEMI & { creditCard?: { id: string; cardName: string; bank: string | null; lastFourDigits: string | null } }) {
  const outstanding  = calcEMIOutstanding(emi);
  const emisRemaining = Math.max(0, emi.tenureMonths - emi.emisPaid);
  const progressPct  = emi.tenureMonths > 0 ? (emi.emisPaid / emi.tenureMonths) * 100 : 0;

  return {
    ...emi,
    totalAmount:  Number(emi.totalAmount),
    emiAmount:    Number(emi.emiAmount),
    interestRate: emi.interestRate ? Number(emi.interestRate) : null,
    outstanding,
    emisRemaining,
    progressPct,
  };
}
