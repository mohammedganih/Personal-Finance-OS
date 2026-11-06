import { Prisma } from '@prisma/client';
import { syncLoanBalance } from '../schedule/progress';
import { monthOf } from '../lib/ledger';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { findCategory } from '../lib/paymentCategory';
import { copySplitToTransactions, deleteTransactionSplits } from '../lib/ownershipSplit';

// Loan history beyond the monthly EMI: prepayments (part payments), interest
// rate changes and closing. Each is a LoanEvent so it shows in the history and
// the latest prepayment or rate change can be undone.

const money = (n: Prisma.Decimal | number | null | undefined) => (n == null ? null : Number(n));
const serialize = <T extends { amount: Prisma.Decimal | null; balanceBefore: Prisma.Decimal | null; balanceAfter: Prisma.Decimal | null; oldRate: Prisma.Decimal | null; newRate: Prisma.Decimal | null; oldEmi: Prisma.Decimal | null; newEmi: Prisma.Decimal | null }>(e: T) => ({
  ...e, amount: money(e.amount), balanceBefore: money(e.balanceBefore), balanceAfter: money(e.balanceAfter),
  oldRate: money(e.oldRate), newRate: money(e.newRate), oldEmi: money(e.oldEmi), newEmi: money(e.newEmi),
});

export async function getLoanEvents(userId: string, loanId: string) {
  const events = await prisma.loanEvent.findMany({ where: { userId, loanId }, orderBy: { date: 'desc' } });
  return events.map(serialize);
}

/** Pays extra principal now. It reduces the balance (not the EMI) and can close the loan. */
export async function prepayLoan(userId: string, loanId: string, input: { amount: number; accountId?: string; date?: string; note?: string }) {
  const categoryId = await findCategory(userId, 'Loan EMI');
  const wealthCategory = await findCategory(userId, 'Wealth Creation');
  return prisma.$transaction(async tx => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId, isActive: true } });
    if (!loan) throw createError('Loan not found or already closed', 404);
    const before = Number(loan.remainingBalance);
    if (!(input.amount > 0)) throw createError('Amount must be positive', 400);
    if (input.amount > before + 0.005) throw createError(`That is more than the ₹${before.toLocaleString('en-IN')} left on this loan`, 400);
    const sourceAccount = input.accountId || loan.bankAccountId || undefined;
    if (sourceAccount && !await tx.account.findFirst({ where: { id: sourceAccount, userId } })) throw createError('Account not found', 404);
    const date = input.date ? new Date(`${input.date}T12:00:00+05:30`) : new Date();
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86_400_000) throw createError('Date is not valid', 400);

    const after = Math.max(0, Math.round((before - input.amount) * 100) / 100);
    const closes = after < 1;
    const txn = await tx.transaction.create({ data: {
      userId, type: 'EXPENSE', kind: 'DEBT', sourceType: 'LOAN_EVENT', period: monthOf(date), amount: input.amount, description: `Prepayment: ${loan.name}`, date,
      categoryId: (loan.linkedInvestmentId ? wealthCategory : categoryId) ?? undefined, isWealthTransfer: !!loan.linkedInvestmentId,
      accountId: sourceAccount, memberId: loan.payerMemberId ?? loan.memberId ?? undefined,
    } });
    await copySplitToTransactions(tx, userId, 'LOAN', loanId, [txn.id]);
    if (sourceAccount) await tx.account.update({ where: { id: sourceAccount }, data: { balance: { decrement: input.amount } } });
    await tx.loan.update({ where: { id: loanId }, data: { isActive: !closes } });
    const event = await tx.loanEvent.create({ data: {
      userId, loanId, type: 'PREPAYMENT', date, amount: input.amount, balanceBefore: before, balanceAfter: after,
      accountId: sourceAccount ?? null, transactionId: txn.id, note: input.note ?? null,
    } });
    await tx.transaction.update({ where: { id: txn.id }, data: { sourceId: event.id } });
    await syncLoanBalance(tx, loanId);
    if (closes) await tx.loanEvent.create({ data: { userId, loanId, type: 'CLOSED', date, balanceBefore: before, balanceAfter: 0, note: 'Closed by prepayment' } });
    return { event: serialize(event), isPaidOff: closes };
  });
}

/** Records a new interest rate (and optionally a new EMI) from now on. */
export async function changeLoanRate(userId: string, loanId: string, input: { interestRate: number; emi?: number; date?: string; note?: string }) {
  return prisma.$transaction(async tx => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) throw createError('Loan not found', 404);
    if (!(input.interestRate >= 0 && input.interestRate <= 100)) throw createError('Interest rate must be between 0 and 100', 400);
    if (input.emi !== undefined && !(input.emi > 0)) throw createError('EMI must be positive', 400);
    const event = await tx.loanEvent.create({ data: {
      userId, loanId, type: 'RATE_CHANGE', date: input.date ? new Date(`${input.date}T12:00:00+05:30`) : new Date(),
      oldRate: loan.interestRate, newRate: input.interestRate, oldEmi: loan.emi, newEmi: input.emi ?? loan.emi,
      balanceBefore: loan.remainingBalance, balanceAfter: loan.remainingBalance, note: input.note ?? null,
    } });
    await tx.loan.update({ where: { id: loanId }, data: { interestRate: input.interestRate, ...(input.emi !== undefined && { emi: input.emi }) } });
    return serialize(event);
  });
}

/** Undoes the loan's most recent prepayment or rate change. */
export async function undoLoanEvent(userId: string, loanId: string, eventId: string) {
  return prisma.$transaction(async tx => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) throw createError('Loan not found', 404);
    const event = await tx.loanEvent.findFirst({ where: { id: eventId, loanId, userId } });
    if (!event) throw createError('History entry not found', 404);
    if (event.type !== 'PREPAYMENT' && event.type !== 'RATE_CHANGE') throw createError('Only prepayments and rate changes can be undone here', 400);
    const latest = await tx.loanEvent.findFirst({ where: { loanId, type: { in: ['PREPAYMENT', 'RATE_CHANGE'] } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    if (latest?.id !== event.id) throw createError('Undo the most recent change first', 409);

    if (event.type === 'RATE_CHANGE') {
      await tx.loan.update({ where: { id: loanId }, data: { interestRate: event.oldRate ?? loan.interestRate, emi: event.oldEmi ?? loan.emi } });
    } else {
      // A later EMI was worked out from the reduced balance, so it must be undone first.
      const laterEmi = await tx.monthlyPayment.findFirst({ where: { userId, entityType: 'LOAN', entityId: loanId, status: 'PAID', createdAt: { gt: event.createdAt } } });
      if (laterEmi) throw createError(`Undo the ${laterEmi.month} EMI first`, 409);
      if (event.transactionId) {
        const txn = await tx.transaction.findFirst({ where: { id: event.transactionId, userId } });
        if (txn) {
          if (txn.accountId) await tx.account.update({ where: { id: txn.accountId }, data: { balance: { increment: txn.amount } } });
          await deleteTransactionSplits(tx, [txn.id]);
          await tx.transaction.delete({ where: { id: txn.id } });
        }
      }
      await tx.loan.update({ where: { id: loanId }, data: { isActive: true } });
      await tx.loanEvent.deleteMany({ where: { loanId, type: 'CLOSED', createdAt: { gte: event.createdAt } } });
    }
    await tx.loanEvent.delete({ where: { id: event.id } });
    if (event.type === 'PREPAYMENT') await syncLoanBalance(tx, loanId);
    return { undone: true, type: event.type };
  });
}
