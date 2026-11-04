import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { currentMonth, monthWindow } from './monthlyPayments.service';
import { undoOccurrence } from './bill.service';

export type UndoType = 'LOAN' | 'INVESTMENT' | 'CARD_EMI' | 'BILL';
export interface UndoInput { type: UndoType; id: string; month?: string; dueDate?: string }

/**
 * Reverses a recorded paid or skipped instalment, exactly undoing what the pay
 * action wrote: its transactions, the bank balance it drew down, and the loan
 * balance / RD instalment count / card EMI count it moved on. Skips just clear.
 */
export async function undoPayment(userId: string, input: UndoInput) {
  if (input.type === 'BILL') {
    if (!input.dueDate) throw createError('dueDate is required to undo a bill', 400);
    await undoOccurrence(userId, input.id, input.dueDate);
    return { type: input.type, id: input.id, undone: true };
  }
  const month = input.month ?? currentMonth();
  monthWindow(month);

  return prisma.$transaction(async tx => {
    const key = { userId, entityType: input.type, entityId: input.id, month };
    const event = await tx.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: key } });
    if (!event) throw createError('No payment recorded for this month', 404);

    if (event.status === 'PAID') {
      // Loans and card EMIs move a running balance/count forward, so only the
      // most recent payment can be reversed cleanly.
      if (input.type !== 'INVESTMENT') {
        const later = await tx.monthlyPayment.findFirst({ where: { userId, entityType: input.type, entityId: input.id, status: 'PAID', month: { gt: month } } });
        if (later) throw createError(`Undo the ${later.month} payment first`, 409);
      }
      const txns = event.transactionIds.length
        ? await tx.transaction.findMany({ where: { id: { in: event.transactionIds }, userId } })
        : [];
      await reverseEntity(tx, userId, input.type, input.id, txns);
      for (const t of txns) {
        if (t.accountId) await tx.account.update({ where: { id: t.accountId }, data: { balance: { increment: t.amount } } });
      }
      if (txns.length) await tx.transaction.deleteMany({ where: { id: { in: txns.map(t => t.id) }, userId } });
    }
    await tx.monthlyPayment.delete({ where: { id: event.id } });
    return { type: input.type, id: input.id, month, undone: true, previousStatus: event.status };
  });
}

type Txn = { id: string; amount: Prisma.Decimal; description: string | null };

async function reverseEntity(tx: Prisma.TransactionClient, userId: string, type: UndoType, id: string, txns: Txn[]) {
  if (type === 'LOAN') {
    const loan = await tx.loan.findFirst({ where: { id, userId } });
    if (!loan) throw createError('Loan not found', 404);
    // Interest never reduced the balance; only the principal portion did.
    const principal = txns.filter(t => !(t.description ?? '').startsWith('EMI Interest:')).reduce((s, t) => s + Number(t.amount), 0);
    await tx.loan.update({ where: { id }, data: { remainingBalance: { increment: principal }, isActive: true } });
  } else if (type === 'INVESTMENT') {
    const inv = await tx.investment.findFirst({ where: { id, userId } });
    if (!inv) throw createError('Investment not found', 404);
    if (inv.assetType === 'RECURRING_DEPOSIT' && Number(inv.quantity) >= 1) {
      await tx.investment.update({ where: { id }, data: { quantity: { decrement: 1 } } });
    }
  } else if (type === 'CARD_EMI') {
    const emi = await tx.cardEMI.findFirst({ where: { id, userId } });
    if (!emi) throw createError('Card EMI not found', 404);
    await tx.cardEMI.update({ where: { id }, data: { emisPaid: Math.max(0, emi.emisPaid - 1), isArchived: false } });
  }
}
