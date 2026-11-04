import { CreditCard, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { assertOwnMembers } from '../lib/ownershipSplit';
import { createError } from '../middleware/error.middleware';
import { CreateCreditCardInput, UpdateCreditCardInput } from '../validators/credit-card.validator';
import { findCategory } from '../lib/paymentCategory';
import { indiaDateKey } from '../lib/cardPaymentSchedule';
import { syncCardFromStatements } from './cardStatement.service';

export async function getCreditCards(userId: string) {
  const cards = await prisma.creditCard.findMany({
    where: { userId, isActive: true },
    orderBy: { dueDate: 'asc' },
  });
  return cards.map(serialize);
}

export async function createCreditCard(userId: string, input: CreateCreditCardInput) {
  await validatePaymentAccount(userId, input.bankAccountId);
  await assertOwnMembers(userId, [input.memberId]);
  const card = await prisma.creditCard.create({
    data: {
      userId,
      bankAccountId: input.bankAccountId,
      memberId:      input.memberId ?? null,
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

  await validatePaymentAccount(userId, input.bankAccountId);
  await assertOwnMembers(userId, [input.memberId]);
  const card = await prisma.creditCard.update({
    where: { id },
    data: {
      ...(input.memberId       !== undefined && { memberId: input.memberId }),
      ...(input.bankAccountId !== undefined && { bankAccountId: input.bankAccountId }),
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

/** Month a card's saved statement is due in: an overdue statement counts as this month's. */
export function cardStatementMonth(dueDate: Date, now = new Date()) {
  const due = indiaDateKey(dueDate).slice(0, 7);
  const current = indiaDateKey(now).slice(0, 7);
  return due < current ? current : due;
}

/**
 * Pays (all or part of) a card statement. This is where card EMIs and
 * card-charged bills turn into real money: one expense, one bank debit. Each
 * payment is kept on the statement month's MonthlyPayment record so it shows as
 * paid and can be undone. With a saved statement for that month, the payment is
 * capped at what is still owed on it; otherwise at the card's saved outstanding.
 */
export async function payCreditCardBill(
  userId: string,
  cardId: string,
  amount: number,
  accountId?: string | null,
  options: { month?: string; paidDate?: string } = {},
) {
  const card = await prisma.creditCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw createError('Credit card not found', 404);

  const month = options.month ?? cardStatementMonth(card.dueDate);
  const statement = await prisma.cardStatement.findUnique({ where: { creditCardId_month: { creditCardId: cardId, month } } });
  if (!statement && month !== cardStatementMonth(card.dueDate)) throw createError('No statement saved for that month', 404);
  const key = { userId, entityType: 'CREDIT_CARD', entityId: cardId, month };
  const before = await prisma.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: key } });
  const owed = statement
    ? Number(statement.totalDue) - (before?.status === 'PAID' ? Number(before.amount) : 0)
    : Number(card.outstanding);
  const payment = Math.round(Math.min(amount, owed) * 100) / 100; // can't pay more than is owed
  if (payment <= 0) throw createError(statement ? 'This statement is already paid' : 'Nothing is outstanding on this card', 400);
  const paidOn = options.paidDate ? new Date(`${options.paidDate}T12:00:00+05:30`) : new Date();
  if (Number.isNaN(paidOn.getTime()) || paidOn.getTime() > Date.now() + 86_400_000) throw createError('Paid date is not valid', 400);
  const sourceAccount = accountId || card.bankAccountId || undefined;
  if (sourceAccount && !await prisma.account.findFirst({ where: { id: sourceAccount, userId } })) throw createError('Account not found', 404);

  const categoryId = await findCategory(userId, 'Credit Card Bill');

  return prisma.$transaction(async tx => {
    if (!statement) await tx.creditCard.update({ where: { id: cardId }, data: { outstanding: Math.max(0, Number(card.outstanding) - payment) } });
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      payment,
        description: `Bill: ${card.cardName}${card.lastFourDigits ? ` ···· ${card.lastFourDigits}` : ''}`,
        date:        paidOn,
        categoryId:  categoryId ?? undefined,
        accountId:   sourceAccount,
        memberId:    card.memberId ?? undefined,
        isRecurring: true,
      },
    });
    // Paying a bill from a bank account draws down that account's balance too.
    if (sourceAccount) await tx.account.update({ where: { id: sourceAccount }, data: { balance: { decrement: payment } } });

    const existing = await tx.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: key } });
    if (existing) {
      await tx.monthlyPayment.update({ where: { id: existing.id }, data: { status: 'PAID', amount: { increment: payment }, transactionIds: [...existing.transactionIds, transaction.id] } });
    } else {
      await tx.monthlyPayment.create({ data: { ...key, status: 'PAID', amount: payment, transactionIds: [transaction.id] } });
    }
    if (statement) await syncCardFromStatements(tx, userId, cardId);
    const updatedCard = await tx.creditCard.findUniqueOrThrow({ where: { id: cardId } });
    return {
      card:        serialize(updatedCard),
      transaction: { ...transaction, amount: Number(transaction.amount) },
      paid:        payment,
      month,
    };
  });
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

async function validatePaymentAccount(userId: string, id?: string | null) {
  if (id && !await prisma.account.findFirst({ where: { id, userId, isActive: true, type: { in: ['SAVINGS', 'CHECKING'] } } })) throw createError('Active bank account not found', 404);
}
