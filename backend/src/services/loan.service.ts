import { Prisma, Loan, FamilyMember, Account, Investment } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateLoanInput, UpdateLoanInput } from '../validators/loan.validator';
import { findCategory } from '../lib/paymentCategory';
import { balanceAdjustment } from '../lib/accountBalance';

type LoanWithRelations = Loan & {
  member?: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  payer?: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
  bankAccount?: Pick<Account, 'id' | 'name' | 'type'> | null;
  linkedInvestment?: Pick<Investment, 'id' | 'assetName' | 'assetType' | 'currentPrice' | 'ownershipPercent'> | null;
};

const LOAN_INCLUDE = {
  member:           { select: { id: true, name: true, color: true, emoji: true } },
  payer:            { select: { id: true, name: true, color: true, emoji: true } },
  bankAccount:      { select: { id: true, name: true, type: true } },
  linkedInvestment: { select: { id: true, assetName: true, assetType: true, currentPrice: true, ownershipPercent: true } },
} as const;

export async function getLoans(userId: string) {
  const loans = await prisma.loan.findMany({
    where:   { userId },
    include: LOAN_INCLUDE,
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
      linkedInvestmentId: input.linkedInvestmentId,
    },
    include: LOAN_INCLUDE,
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
      ...(input.linkedInvestmentId !== undefined && { linkedInvestmentId: input.linkedInvestmentId }),
    },
    include: LOAN_INCLUDE,
  });
  return serializeLoan(loan);
}

/** Links (or unlinks, with investmentId = null) a Loan to a collateral asset. */
export async function linkLoanAsset(userId: string, loanId: string, investmentId: string | null) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw createError('Loan not found', 404);

  if (investmentId) {
    const investment = await prisma.investment.findFirst({ where: { id: investmentId, userId } });
    if (!investment) throw createError('Investment not found', 404);
  }

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { linkedInvestmentId: investmentId },
    include: LOAN_INCLUDE,
  });
  return serializeLoan(updated);
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

/**
 * Splits one EMI payment into interest/principal using proper amortization
 * (not a flat remaining/tenure division), and reports the resulting balance.
 * Pure function -- no I/O -- so amortization correctness can be unit tested
 * without a database.
 */
export function calculateEMISplit(remainingBalance: number, emi: number, annualInterestRatePercent: number) {
  const r = annualInterestRatePercent / 100 / 12; // monthly rate

  const interestPortion  = r > 0 ? remainingBalance * r : 0;
  const principalPortion = Math.max(0, emi - interestPortion);
  const actualPayment    = Math.min(emi, remainingBalance + interestPortion); // can't overpay
  const newBalance       = Math.max(0, remainingBalance - principalPortion);
  const isPaidOff        = newBalance < 1; // treat < ₹1 as fully paid

  return { interestPortion, principalPortion, actualPayment, newBalance, isPaidOff };
}

/**
 * Pays one EMI installment, splitting it into two ledger transactions instead
 * of one: interest is a real expense; principal reduces debt and (when the
 * loan is linked to a collateral asset) is tagged isWealthTransfer so expense
 * analytics excludes it -- it builds equity, it doesn't get spent. Unlinked
 * loans keep principal under the same "Loan EMI" category, untagged, so
 * their dashboard math is unchanged from before this feature existed.
 */
export async function payLoanEMI(userId: string, loanId: string, accountId?: string) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId, isActive: true } });
  if (!loan) throw createError('Loan not found or already paid off', 404);

  const remaining = Number(loan.remainingBalance);
  const emi       = Number(loan.emi);

  const { interestPortion, principalPortion, actualPayment, newBalance, isPaidOff } =
    calculateEMISplit(remaining, emi, Number(loan.interestRate));

  const isLinked = !!loan.linkedInvestmentId;
  const [emiCategoryId, wealthCategoryId] = await Promise.all([
    findCategory(userId, 'Loan EMI'),
    isLinked ? findCategory(userId, 'Wealth Creation') : Promise.resolve(null),
  ]);

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: newBalance,
        ...(isPaidOff && { isActive: false }),
      },
      include: LOAN_INCLUDE,
    }),
  ];

  if (interestPortion > 0) {
    ops.push(prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      interestPortion,
        description: `EMI Interest: ${loan.name}`,
        date:        now,
        categoryId:  emiCategoryId ?? undefined,
        accountId:   accountId ?? undefined,
        isRecurring: true,
      },
    }));
  }

  if (principalPortion > 0) {
    ops.push(prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount:      principalPortion,
        description: `EMI Principal: ${loan.name}`,
        date:        now,
        categoryId:  isLinked ? (wealthCategoryId ?? undefined) : (emiCategoryId ?? undefined),
        accountId:   accountId ?? undefined,
        isRecurring: true,
        isWealthTransfer: isLinked,
      },
    }));
  }

  // Paying an EMI from a bank account draws down that account's balance too.
  if (accountId) ops.push(balanceAdjustment(accountId, -actualPayment));

  const results = await prisma.$transaction(ops);
  const updatedLoan = results[0] as LoanWithRelations;
  const transactions = results.slice(1, 1 + [interestPortion > 0, principalPortion > 0].filter(Boolean).length) as { amount: { toString(): string } }[];

  return {
    loan:       serializeLoan(updatedLoan),
    transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    isPaidOff,
    interestPortion,
    principalPortion,
  };
}

function serializeLoan(loan: LoanWithRelations) {
  return {
    ...loan,
    principal: Number(loan.principal),
    emi: Number(loan.emi),
    remainingBalance: Number(loan.remainingBalance),
    interestRate: Number(loan.interestRate),
    linkedInvestment: loan.linkedInvestment
      ? { ...loan.linkedInvestment, currentPrice: Number(loan.linkedInvestment.currentPrice), ownershipPercent: loan.linkedInvestment.ownershipPercent ? Number(loan.linkedInvestment.ownershipPercent) : null }
      : null,
  };
}
