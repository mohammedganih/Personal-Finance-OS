import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateLoanInput, UpdateLoanInput } from '../validators/loan.validator';
import { findCategory } from '../lib/paymentCategory';
import { balanceAdjustment } from '../lib/accountBalance';

export async function getLoans(userId: string) {
  const loans = await prisma.loan.findMany({
    where:   { userId },
    include: {
      member:      { select: { id: true, name: true, color: true, emoji: true } },
      payer:       { select: { id: true, name: true, color: true, emoji: true } },
      bankAccount: { select: { id: true, name: true, type: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  return loans.map(serializeLoan);
}

export async function createLoan(userId: string, input: CreateLoanInput) {
  const loan = await prisma.loan.create({
    data: {
      userId,
      name:             input.name,
      loanType:         input.loanType,
      principal:        input.principal,
      interestRate:     input.interestRate,
      emi:              input.emi,
      remainingBalance: input.remainingBalance,
      tenureMonths:     input.tenureMonths,
      startDate:        new Date(input.startDate),
      lender:           input.lender,
      notes:            input.notes,
      memberId:         input.memberId,
      payerMemberId:    input.payerMemberId,
      bankAccountId:    input.bankAccountId,
    },
  });
  return serializeLoan(loan);
}

export async function updateLoan(userId: string, id: string, input: UpdateLoanInput) {
  const existing = await prisma.loan.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Loan not found', 404);

  const loan = await prisma.loan.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.loanType && { loanType: input.loanType }),
      ...(input.principal !== undefined && { principal: input.principal }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate }),
      ...(input.emi !== undefined && { emi: input.emi }),
      ...(input.remainingBalance !== undefined && { remainingBalance: input.remainingBalance }),
      ...(input.tenureMonths !== undefined && { tenureMonths: input.tenureMonths }),
      ...(input.startDate && { startDate: new Date(input.startDate) }),
      ...(input.lender !== undefined && { lender: input.lender }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive       !== undefined && { isActive: input.isActive }),
      ...(input.memberId       !== undefined && { memberId: input.memberId }),
      ...(input.payerMemberId  !== undefined && { payerMemberId: input.payerMemberId }),
      ...(input.bankAccountId  !== undefined && { bankAccountId: input.bankAccountId }),
    },
  });
  return serializeLoan(loan);
}

export async function deleteLoan(userId: string, id: string) {
  const existing = await prisma.loan.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Loan not found', 404);
  await prisma.loan.delete({ where: { id } });
}

export async function getLoanSummary(userId: string) {
  const loans = await prisma.loan.findMany({ where: { userId, isActive: true } });
  const totalDebt = loans.reduce((s, l) => s + Number(l.remainingBalance), 0);
  const monthlyEMI = loans.reduce((s, l) => s + Number(l.emi), 0);
  return { totalDebt, monthlyEMI, activeLoans: loans.length, loans: loans.map(serializeLoan) };
}

export async function payLoanEMI(userId: string, loanId: string, accountId?: string) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId, isActive: true } });
  if (!loan) throw createError('Loan not found or already paid off', 404);

  const remaining = Number(loan.remainingBalance);
  const emi       = Number(loan.emi);
  const r         = Number(loan.interestRate) / 100 / 12; // monthly rate

  // Proper amortization: split EMI into interest and principal portions
  const interestPortion   = r > 0 ? remaining * r : 0;
  const principalPortion  = Math.max(0, emi - interestPortion);
  const actualPayment     = Math.min(emi, remaining + interestPortion); // can't overpay
  const newBalance        = Math.max(0, remaining - principalPortion);
  const isPaidOff         = newBalance < 1; // treat < ₹1 as fully paid

  const categoryId = await findCategory(userId, 'Loan EMI');

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: newBalance,
        ...(isPaidOff && { isActive: false }),
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      actualPayment,
        description: `EMI: ${loan.name}`,
        date:        new Date(),
        categoryId:  categoryId ?? undefined,
        accountId:   accountId  ?? undefined,
        isRecurring: true,
      },
    }),
  ];

  // Paying an EMI from a bank account draws down that account's balance too.
  if (accountId) ops.push(balanceAdjustment(accountId, -actualPayment));

  const [updatedLoan, transaction] = await prisma.$transaction(ops);
  const txn = transaction as { amount: { toString(): string } };

  return {
    loan:       serializeLoan(updatedLoan as Record<string, unknown>),
    transaction: { ...txn, amount: Number(txn.amount) },
    isPaidOff,
    interestPortion,
    principalPortion,
  };
}

function serializeLoan(loan: Record<string, unknown>) {
  return {
    ...loan,
    principal: Number((loan as { principal: { toString(): string } }).principal),
    emi: Number((loan as { emi: { toString(): string } }).emi),
    remainingBalance: Number((loan as { remainingBalance: { toString(): string } }).remainingBalance),
    interestRate: Number((loan as { interestRate: { toString(): string } }).interestRate),
  };
}
