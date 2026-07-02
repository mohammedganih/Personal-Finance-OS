import { Investment } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateInvestmentInput, UpdateInvestmentInput } from '../validators/investment.validator';
import { findCategory } from '../lib/paymentCategory';

const MEMBER_SELECT = { select: { id: true, name: true, color: true, emoji: true } };

export async function getInvestments(userId: string) {
  const investments = await prisma.investment.findMany({
    where: { userId },
    include: { member: MEMBER_SELECT, splitMember: MEMBER_SELECT, bankAccount: { select: { id: true, name: true, type: true } } },
    orderBy: { purchaseDate: 'desc' },
  });
  return investments.map(serializeInvestment);
}

export async function createInvestment(userId: string, input: CreateInvestmentInput) {
  const investment = await prisma.investment.create({
    data: {
      userId,
      assetName:     input.assetName,
      assetType:     input.assetType,
      ticker:        input.ticker,
      quantity:      input.quantity ?? 0,
      buyPrice:      input.buyPrice ?? 0,
      currentPrice:  input.currentPrice ?? 0,
      purchaseDate:  new Date(input.purchaseDate),
      exchange:      input.exchange,
      notes:         input.notes,
      monthlyAmount: input.monthlyAmount,
      fundCategory:  input.fundCategory,
      folioNumber:   input.folioNumber,
      maturityDate:  input.maturityDate ? new Date(input.maturityDate) : null,
      maturityAmount: input.maturityAmount,
      interestRate:  input.interestRate,
      platform:      input.platform,
      memberId:      input.memberId,
      splitMemberId: input.splitMemberId,
      splitRatio:    input.splitRatio,
      bankAccountId: input.bankAccountId,
    },
    include: { member: MEMBER_SELECT, splitMember: MEMBER_SELECT, bankAccount: { select: { id: true, name: true, type: true } } },
  });
  return serializeInvestment(investment);
}

export async function updateInvestment(userId: string, id: string, input: UpdateInvestmentInput) {
  const existing = await prisma.investment.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Investment not found', 404);

  const investment = await prisma.investment.update({
    where: { id },
    data: {
      ...(input.assetName    !== undefined && { assetName: input.assetName }),
      ...(input.assetType    !== undefined && { assetType: input.assetType }),
      ...(input.ticker       !== undefined && { ticker: input.ticker }),
      ...(input.quantity     !== undefined && { quantity: input.quantity }),
      ...(input.buyPrice     !== undefined && { buyPrice: input.buyPrice }),
      ...(input.currentPrice !== undefined && { currentPrice: input.currentPrice }),
      ...(input.purchaseDate !== undefined && { purchaseDate: new Date(input.purchaseDate) }),
      ...(input.exchange     !== undefined && { exchange: input.exchange }),
      ...(input.notes        !== undefined && { notes: input.notes }),
      ...(input.monthlyAmount !== undefined && { monthlyAmount: input.monthlyAmount }),
      ...(input.fundCategory !== undefined && { fundCategory: input.fundCategory }),
      ...(input.folioNumber  !== undefined && { folioNumber: input.folioNumber }),
      ...(input.maturityDate !== undefined && { maturityDate: input.maturityDate ? new Date(input.maturityDate) : null }),
      ...(input.maturityAmount !== undefined && { maturityAmount: input.maturityAmount }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate }),
      ...(input.platform      !== undefined && { platform:      input.platform }),
      ...(input.memberId      !== undefined && { memberId:      input.memberId      ?? null }),
      ...(input.splitMemberId !== undefined && { splitMemberId: input.splitMemberId ?? null }),
      ...(input.splitRatio    !== undefined && { splitRatio:    input.splitRatio }),
      ...(input.bankAccountId !== undefined && { bankAccountId: input.bankAccountId ?? null }),
    },
    include: { member: MEMBER_SELECT, splitMember: MEMBER_SELECT, bankAccount: { select: { id: true, name: true, type: true } } },
  });
  return serializeInvestment(investment);
}

export async function deleteInvestment(userId: string, id: string) {
  const existing = await prisma.investment.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Investment not found', 404);
  await prisma.investment.delete({ where: { id } });
}

// ── Types that have a recurring monthly payment ───────────────────────────────
const INSTALLMENT_TYPES = new Set(['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME']);

export async function payInvestment(userId: string, id: string, accountId?: string) {
  const inv = await prisma.investment.findFirst({ where: { id, userId } });
  if (!inv) throw createError('Investment not found', 404);

  const isInstallment = INSTALLMENT_TYPES.has(inv.assetType);

  // ── Resolve the payment amount ─────────────────────────────────────────
  let amount: number;
  let description: string;
  let isRecurring = false;

  if (isInstallment) {
    // Monthly instalment — requires monthlyAmount to be set
    if (!inv.monthlyAmount) throw createError('Monthly amount not configured for this investment', 400);
    amount      = Number(inv.monthlyAmount);
    isRecurring = true;
    description =
      inv.assetType === 'SIP'               ? `SIP: ${inv.assetName}` :
      inv.assetType === 'RECURRING_DEPOSIT' ? `RD Deposit: ${inv.assetName}` :
                                              `Gold Scheme: ${inv.assetName}`;
  } else {
    // Lump-sum purchase — use total invested value
    const qty    = Number(inv.quantity);
    const buyPx  = Number(inv.buyPrice);
    amount       = qty > 0 && buyPx > 0 ? qty * buyPx : buyPx;
    description  = `Investment: ${inv.assetName}`;
  }

  if (amount <= 0) throw createError('Cannot log a ₹0 payment', 400);

  const categoryId = await findCategory(userId, 'Investment');

  // ── For RD: also increment the instalment count ────────────────────────
  const rdIncrement = inv.assetType === 'RECURRING_DEPOSIT';

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        amount,
        description,
        date:        new Date(),
        categoryId:  categoryId ?? undefined,
        accountId:   accountId  ?? undefined,
        isRecurring,
      },
    }),
    ...(rdIncrement
      ? [prisma.investment.update({ where: { id }, data: { quantity: { increment: 1 } } })]
      : []),
  ]);

  return {
    transaction: { ...transaction, amount: Number(transaction.amount) },
    amount,
    isInstallment,
  };
}

/**
 * Per-type invested/current value math -- exported so investmentIntelligence
 * .service.ts (annualized return, diversification, etc.) can reuse the exact
 * same valuation rules instead of re-deriving them.
 */
export function computeInvestmentValue(inv: Investment, now: Date): { investedValue: number; currentValue: number } {
  const qty     = Number(inv.quantity);
  const buyPx   = Number(inv.buyPrice);
  const curPx   = Number(inv.currentPrice);
  const monthly = inv.monthlyAmount ? Number(inv.monthlyAmount) : 0;
  const rate    = inv.interestRate   ? Number(inv.interestRate)  : 0;

  switch (inv.assetType) {

    case 'RECURRING_DEPOSIT': {
      // qty = installments paid (user-entered, source of truth)
      const deposited      = monthly * qty;
      const monthlyRate    = rate / 100 / 12;
      // Each deposit k earns interest for (qty - k + 1) months: sum = qty*(qty+1)/2
      const interestSoFar  = monthly * monthlyRate * ((qty * (qty + 1)) / 2);
      return { investedValue: deposited, currentValue: deposited + interestSoFar };
    }

    case 'FIXED_DEPOSIT': {
      // buyPrice = principal, interestRate = rate, purchaseDate = start
      const principal      = buyPx;
      const monthsElapsed  = monthDiff(inv.purchaseDate, now);
      const interestSoFar  = principal * (rate / 100) * (monthsElapsed / 12);
      return { investedValue: principal, currentValue: principal + interestSoFar };
    }

    case 'SIP': {
      // monthlyAmount × months elapsed = total invested. qty × curPx = current value
      const monthsElapsed = monthDiff(inv.purchaseDate, now);
      return { investedValue: monthly * monthsElapsed, currentValue: qty * curPx };
    }

    case 'GOLD_SCHEME': {
      // monthly × months running = total paid. qty (grams) × curPx = current value
      const monthsElapsed = monthDiff(inv.purchaseDate, now);
      return { investedValue: monthly * monthsElapsed, currentValue: qty * curPx };
    }

    case 'REAL_ESTATE': {
      return { investedValue: buyPx, currentValue: curPx };
    }

    default: {
      // STOCK, ETF, CRYPTO, MUTUAL_FUND, GOLD, OTHER
      return { investedValue: qty * buyPx, currentValue: qty * curPx };
    }
  }
}

export async function getPortfolioSummary(userId: string) {
  const investments = await prisma.investment.findMany({
    where: { userId },
    include: { member: MEMBER_SELECT, splitMember: MEMBER_SELECT, bankAccount: { select: { id: true, name: true, type: true } } },
  });

  const now = new Date();

  const portfolio = investments.map((inv) => {
    const { investedValue, currentValue } = computeInvestmentValue(inv, now);
    const pnl        = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return { ...serializeInvestment(inv), investedValue, currentValue, pnl, pnlPercent };
  });

  const totalInvested = portfolio.reduce((s, i) => s + i.investedValue, 0);
  const totalCurrent  = portfolio.reduce((s, i) => s + i.currentValue, 0);
  const totalPnl      = totalCurrent - totalInvested;

  const allocationByType = portfolio.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.assetType] = (acc[inv.assetType] || 0) + inv.currentValue;
    return acc;
  }, {});

  return { portfolio, totalInvested, totalCurrent, totalPnl, allocationByType };
}

/** Whole months between two dates (floor). */
function monthDiff(from: Date, to: Date): number {
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()),
  );
}

function serializeInvestment(inv: Investment) {
  return {
    ...inv,
    quantity:       Number(inv.quantity),
    buyPrice:       Number(inv.buyPrice),
    currentPrice:   Number(inv.currentPrice),
    monthlyAmount:  inv.monthlyAmount  ? Number(inv.monthlyAmount)  : null,
    maturityAmount: inv.maturityAmount ? Number(inv.maturityAmount) : null,
    interestRate:   inv.interestRate   ? Number(inv.interestRate)   : null,
  };
}
