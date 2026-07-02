import { CreditCard } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateCreditCardInput, UpdateCreditCardInput } from '../validators/credit-card.validator';
import { findCategory } from '../lib/paymentCategory';

export async function getCreditCards(userId: string) {
  const cards = await prisma.creditCard.findMany({
    where: { userId, isActive: true },
    orderBy: { dueDate: 'asc' },
  });
  return cards.map(serialize);
}

export async function createCreditCard(userId: string, input: CreateCreditCardInput) {
  const card = await prisma.creditCard.create({
    data: {
      userId,
      cardName:       input.cardName,
      bank:           input.bank,
      lastFourDigits: input.lastFourDigits,
      creditLimit:    input.creditLimit,
      outstanding:    input.outstanding ?? 0,
      minimumPayment: input.minimumPayment,
      dueDate:        new Date(input.dueDate),
      statementDate:  input.statementDate ? new Date(input.statementDate) : null,
      interestRate:   input.interestRate,
      color:          input.color,
      notes:          input.notes,
    },
  });
  return serialize(card);
}

export async function updateCreditCard(userId: string, id: string, input: UpdateCreditCardInput) {
  const existing = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Credit card not found', 404);

  const card = await prisma.creditCard.update({
    where: { id },
    data: {
      ...(input.cardName       !== undefined && { cardName: input.cardName }),
      ...(input.bank           !== undefined && { bank: input.bank }),
      ...(input.lastFourDigits !== undefined && { lastFourDigits: input.lastFourDigits }),
      ...(input.creditLimit    !== undefined && { creditLimit: input.creditLimit }),
      ...(input.outstanding    !== undefined && { outstanding: input.outstanding }),
      ...(input.minimumPayment !== undefined && { minimumPayment: input.minimumPayment }),
      ...(input.dueDate        !== undefined && { dueDate: new Date(input.dueDate) }),
      ...(input.statementDate  !== undefined && { statementDate: input.statementDate ? new Date(input.statementDate) : null }),
      ...(input.interestRate   !== undefined && { interestRate: input.interestRate }),
      ...(input.color          !== undefined && { color: input.color }),
      ...(input.notes          !== undefined && { notes: input.notes }),
      ...(input.isActive       !== undefined && { isActive: input.isActive }),
    },
  });
  return serialize(card);
}

export async function deleteCreditCard(userId: string, id: string) {
  const existing = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Credit card not found', 404);
  await prisma.creditCard.delete({ where: { id } });
}

export async function payCreditCardBill(
  userId: string,
  cardId: string,
  amount: number,
  accountId?: string,
) {
  const card = await prisma.creditCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw createError('Credit card not found', 404);

  const current  = Number(card.outstanding);
  const payment  = Math.min(amount, current); // can't pay more than outstanding
  const newBal   = Math.max(0, current - payment);

  const categoryId = await findCategory(userId, 'Credit Card Bill');

  const [updatedCard, transaction] = await prisma.$transaction([
    prisma.creditCard.update({
      where: { id: cardId },
      data:  { outstanding: newBal },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      payment,
        description: `Bill: ${card.cardName}${card.lastFourDigits ? ` ···· ${card.lastFourDigits}` : ''}`,
        date:        new Date(),
        categoryId:  categoryId ?? undefined,
        accountId:   accountId  ?? undefined,
        isRecurring: true,
      },
    }),
  ]);

  return {
    card:        serialize(updatedCard),
    transaction: { ...transaction, amount: Number(transaction.amount) },
    paid:        payment,
  };
}

function serialize(card: CreditCard) {
  return {
    ...card,
    creditLimit:    Number(card.creditLimit),
    outstanding:    Number(card.outstanding),
    minimumPayment: card.minimumPayment ? Number(card.minimumPayment) : null,
    interestRate:   card.interestRate   ? Number(card.interestRate)   : null,
  };
}
