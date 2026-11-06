import { firstCardEMIDueDate, indiaDateKey } from '../lib/cardPaymentSchedule';
import { cardEMIInstalmentIndex, syncCardEMIProgress } from '../schedule/progress';
import { CardEMI } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { assertOwnMembers, attachSplit, fetchSplits, saveSplit } from '../lib/ownershipSplit';
import { createError } from '../middleware/error.middleware';
import { CreateCardEMIInput, UpdateCardEMIInput } from '../validators/card-emi.validator';

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
  await syncCardEMIProgress(prisma, userId);
  const emis = await prisma.cardEMI.findMany({
    where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
    orderBy: [{ isArchived: 'asc' }, { startDate: 'desc' }],
  });
  const splits = await fetchSplits('CARD_EMI', emis.map((e) => e.id));
  return emis.map((e) => attachSplit(serializeWithStats(e), splits.get(e.id)));
}

export async function getCardEMIsForCard(userId: string, creditCardId: string) {
  await syncCardEMIProgress(prisma, userId);
  const emis = await prisma.cardEMI.findMany({
    where: { userId, creditCardId, isArchived: false },
    orderBy: { startDate: 'desc' },
  });
  const splits = await fetchSplits('CARD_EMI', emis.map((e) => e.id));
  return emis.map((e) => attachSplit(serializeWithStats(e), splits.get(e.id)));
}

export async function createCardEMI(userId: string, input: CreateCardEMIInput) {
  // Verify the card belongs to this user
  const card = await prisma.creditCard.findFirst({ where: { id: input.creditCardId, userId } });
  if (!card) throw createError('Credit card not found', 404);
  await assertOwnMembers(userId, [input.memberId, input.splitMemberId]);

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
      memberId:     input.memberId ?? null,
    },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
  });
  await saveSplit(userId, 'CARD_EMI', emi.id, input);
  // Instalments billed so far come from the start date, whatever count was typed.
  await syncCardEMIProgress(prisma, userId, emi.id);
  const fresh = await prisma.cardEMI.findUniqueOrThrow({ where: { id: emi.id }, include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } } });
  return attachSplit(serializeWithStats(fresh), (await fetchSplits('CARD_EMI', [emi.id])).get(emi.id));
}

export async function updateCardEMI(userId: string, id: string, input: UpdateCardEMIInput) {
  const existing = await prisma.cardEMI.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card EMI not found', 404);
  await assertOwnMembers(userId, [input.memberId, input.splitMemberId]);
  await saveSplit(userId, 'CARD_EMI', id, input);

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
      ...(input.memberId     !== undefined && { memberId: input.memberId }),
      isArchived: input.isArchived ?? autoArchive,
    },
    include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } },
  });
  await syncCardEMIProgress(prisma, userId, id);
  const fresh = await prisma.cardEMI.findUniqueOrThrow({ where: { id }, include: { creditCard: { select: { id: true, cardName: true, bank: true, lastFourDigits: true } } } });
  return attachSplit(serializeWithStats(fresh ?? emi), (await fetchSplits('CARD_EMI', [id])).get(id));
}

export async function deleteCardEMI(userId: string, id: string) {
  const existing = await prisma.cardEMI.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Card EMI not found', 404);
  await prisma.cardEMI.delete({ where: { id } });
}

/**
 * Ticks off this month's card EMI instalment. The EMI is part of the card bill,
 * so this moves no money: the bank debit and the expense are recorded once,
 * when the card bill itself is paid (credit-card.service payCreditCardBill).
 * `accountId` is accepted for older clients and ignored.
 */
export async function payCardEMI(userId: string, emiId: string, _accountId?: string) {
  try {
    return await prisma.$transaction(async tx => {
      const emi = await tx.cardEMI.findFirst({ where: { id: emiId, userId }, include: { creditCard: true } });
      if (!emi || !emi.creditCard.isActive) throw createError('Card EMI not found', 404);
      // This month's instalment, by the schedule's dates.
      const month = indiaDateKey(new Date()).slice(0, 7);
      const k = cardEMIInstalmentIndex(emi, emi.creditCard, month);
      if (k === null) {
        const first = firstCardEMIDueDate({ ...emi, emisPaid: 0 }, emi.creditCard).slice(0, 7);
        throw createError(month < first ? 'Next installment is not due this month' : 'All instalments for this EMI are already paid', 400);
      }
      const key = { userId, itemType: 'CARD_EMI', itemId: emiId, period: month, dueKey: '' };
      if (await tx.dueStatus.findUnique({ where: { userId_itemType_itemId_period_dueKey: key } })) throw createError('This due-month installment is already recorded', 409);
      await tx.dueStatus.create({ data: { ...key, amount: Number(emi.emiAmount), status: 'PAID', paidDate: new Date() } });
      await syncCardEMIProgress(tx, userId, emiId);
      const updatedEMI = await tx.cardEMI.findUniqueOrThrow({ where: { id: emiId } });
      return { emi: serializeWithStats(updatedEMI), transaction: null, isComplete: k === emi.tenureMonths - 1, billedToCard: true };
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw createError('This due-month installment is already recorded', 409);
    throw error;
  }
}

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
