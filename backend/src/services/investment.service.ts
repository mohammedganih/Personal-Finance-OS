import { decideMonthlyPayment } from './monthlyPayments.service';
import { monthOf } from '../lib/ledger';
import { assertOwned } from '../lib/ownership';
import { Investment, InvestmentCollateral, FamilyMember, Account, Loan } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateInvestmentInput, UpdateInvestmentInput } from '../validators/investment.validator';
import { findCategory } from '../lib/paymentCategory';
import { writeSplit, fetchSplits, attachSplit, SplitFields } from '../lib/ownershipSplit';
import { writeCollateral } from '../lib/investmentCollateral';

const MEMBER_SELECT = { select: { id: true, name: true, color: true, emoji: true } };

type LinkedLoan = Pick<Loan, 'id' | 'name' | 'remainingBalance' | 'interestRate' | 'emi' | 'startDate' | 'tenureMonths' | 'principal'>;

type InvestmentWithRelations = Investment &
  Partial<SplitFields> & {
    member?: Pick<FamilyMember, 'id' | 'name' | 'color' | 'emoji'> | null;
    bankAccount?: Pick<Account, 'id' | 'name' | 'type'> | null;
    linkedLoans?: LinkedLoan[];
    collateral?: Pick<InvestmentCollateral, 'address' | 'ownershipPercent' | 'expectedAppreciationRate'> | null;
  };

const LOAN_SELECT = { select: { id: true, name: true, remainingBalance: true, interestRate: true, emi: true, startDate: true, tenureMonths: true, principal: true } };

const INVESTMENT_INCLUDE = {
  member: MEMBER_SELECT,
  bankAccount: { select: { id: true, name: true, type: true } },
  linkedLoans: LOAN_SELECT,
  collateral: true,
} as const;

export async function getInvestments(userId: string) {
  const investments = await prisma.investment.findMany({
    where: { userId },
    include: INVESTMENT_INCLUDE,
    orderBy: { purchaseDate: 'desc' },
  });
  const splits = await fetchSplits('INVESTMENT', investments.map((i) => i.id));
  return investments.map((i) => serializeInvestment(attachSplit(i, splits.get(i.id))));
}

export async function createInvestment(userId: string, input: CreateInvestmentInput) {
  await assertOwned(userId, { accounts: [input.bankAccountId], members: [input.memberId, input.splitMemberId] });
  const investment = await prisma.$transaction(async (tx) => {
    const created = await tx.investment.create({
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
        bankAccountId: input.bankAccountId,
        paymentDay: input.paymentDay,
        recurringActive: input.recurringActive,
      },
      include: INVESTMENT_INCLUDE,
    });

    await writeSplit(tx, userId, 'INVESTMENT', created.id, input);
    await writeCollateral(tx, created.id, input);

    return { ...created, collateral: await tx.investmentCollateral.findUnique({ where: { investmentId: created.id } }) };
  });

  const splits = await fetchSplits('INVESTMENT', [investment.id]);
  return serializeInvestment(attachSplit(investment, splits.get(investment.id)));
}

export async function updateInvestment(userId: string, id: string, input: UpdateInvestmentInput) {
  const existing = await prisma.investment.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Investment not found', 404);
  await assertOwned(userId, { accounts: [input.bankAccountId], members: [input.memberId, input.splitMemberId] });

  const investment = await prisma.$transaction(async (tx) => {
    const updated = await tx.investment.update({
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
        ...(input.memberId      !== undefined && { memberId:      input.memberId ?? null }),
        ...(input.paymentDay !== undefined && { paymentDay: input.paymentDay }),
        ...(input.recurringActive !== undefined && { recurringActive: input.recurringActive }),
        ...(input.bankAccountId !== undefined && { bankAccountId: input.bankAccountId ?? null }),
      },
      include: INVESTMENT_INCLUDE,
    });

    if (input.splitMemberId !== undefined) {
      await writeSplit(tx, userId, 'INVESTMENT', id, input);
    }
    await writeCollateral(tx, id, input);

    return { ...updated, collateral: await tx.investmentCollateral.findUnique({ where: { investmentId: id } }) };
  });

  const splits = await fetchSplits('INVESTMENT', [id]);
  return serializeInvestment(attachSplit(investment, splits.get(id)));
}

export async function deleteInvestment(userId: string, id: string) {
  const existing = await prisma.investment.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Investment not found', 404);
  await prisma.$transaction(async (tx) => {
    await tx.investment.delete({ where: { id } });
    await tx.ownershipSplit.deleteMany({ where: { entityType: 'INVESTMENT', entityId: id } });
  });
}

// ── Types that have a recurring monthly payment ───────────────────────────────
const INSTALLMENT_TYPES = new Set(['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME']);

export async function payInvestment(userId: string, id: string, accountId?: string) {
  const inv = await prisma.investment.findFirst({ where: { id, userId } });
  if (!inv) throw createError('Investment not found', 404);

  const isInstallment = INSTALLMENT_TYPES.has(inv.assetType);
  if (isInstallment) return { ...await decideMonthlyPayment(userId, 'INVESTMENT', id, 'PAID', accountId), isInstallment: true };

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

  // A lump-sum purchase is a one-off: the reserved record below makes a second
  // press fail instead of logging the full amount again.
  const once = { userId, itemType: 'INVESTMENT_PURCHASE', itemId: id, period: 'ONCE', dueKey: '' };
  if (await prisma.dueStatus.findUnique({ where: { userId_itemType_itemId_period_dueKey: once } })) {
    throw createError('This purchase is already recorded', 409);
  }

  let transaction;
  try {
  [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        type:        'EXPENSE',
        kind:        'SAVE',
        sourceType:  'INVESTMENT',
        sourceId:    id,
        period:      monthOf(new Date()),
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
    prisma.dueStatus.create({ data: { ...once, status: 'PAID', amount, paidDate: new Date(), accountId: accountId ?? null } }),
  ]);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw createError('This purchase is already recorded', 409);
    throw error;
  }

  return {
    transaction: { ...transaction, amount: Number(transaction.amount) },
    amount,
    isInstallment,
  };
}

export interface ScheduleInput {
  pauseFrom?: string | null; pauseUntil?: string | null;
  nextMonthlyAmount?: number | null; nextAmountFrom?: string | null;
}

/** Pauses a SIP/RD/gold scheme for some months, or changes its amount from a month on. */
export async function setInvestmentSchedule(userId: string, id: string, input: ScheduleInput) {
  const inv = await prisma.investment.findFirst({ where: { id, userId } });
  if (!inv) throw createError('Investment not found', 404);
  if (!INSTALLMENT_TYPES.has(inv.assetType)) throw createError('Only SIPs, RDs and gold schemes have monthly instalments', 400);
  const pauseFrom = input.pauseFrom !== undefined ? input.pauseFrom : inv.pauseFrom;
  const pauseUntil = input.pauseUntil !== undefined ? input.pauseUntil : inv.pauseUntil;
  if (pauseUntil && (!pauseFrom || pauseUntil < pauseFrom)) throw createError('Resume month must be after the pause starts', 400);
  const nextAmount = input.nextMonthlyAmount !== undefined ? input.nextMonthlyAmount : inv.nextMonthlyAmount;
  const nextFrom = input.nextAmountFrom !== undefined ? input.nextAmountFrom : inv.nextAmountFrom;
  if ((nextAmount == null) !== (nextFrom == null)) throw createError('Give both the new amount and the month it starts', 400);
  const updated = await prisma.investment.update({
    where: { id },
    data: { pauseFrom, pauseUntil: pauseFrom ? pauseUntil : null, nextMonthlyAmount: nextAmount, nextAmountFrom: nextFrom },
  });
  return {
    id: updated.id, pauseFrom: updated.pauseFrom, pauseUntil: updated.pauseUntil, nextAmountFrom: updated.nextAmountFrom,
    nextMonthlyAmount: updated.nextMonthlyAmount != null ? Number(updated.nextMonthlyAmount) : null,
  };
}

/**
 * Per-type invested/current value math -- exported so investmentIntelligence
 * .service.ts (annualized return, diversification, etc.) can reuse the exact
 * same valuation rules instead of re-deriving them.
 */
export function computeInvestmentValue(
  inv: Investment & { collateral?: Pick<InvestmentCollateral, 'ownershipPercent'> | null },
  now: Date
): { investedValue: number; currentValue: number } {
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

    case 'REAL_ESTATE':
    case 'VEHICLE': {
      // buyPrice/currentPrice are the asset's FULL market value -- only the
      // household's actual ownership share (jointly-owned property, e.g.
      // co-owned with someone outside this app) counts toward this app's
      // portfolio/net worth. Untouched (ownershipPercent unset) = 100%,
      // so pre-existing rows keep their current behavior exactly.
      const ownershipShare = inv.collateral?.ownershipPercent ? Number(inv.collateral.ownershipPercent) / 100 : 1;
      return { investedValue: buyPx * ownershipShare, currentValue: curPx * ownershipShare };
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
    include: INVESTMENT_INCLUDE,
  });
  const splits = await fetchSplits('INVESTMENT', investments.map((i) => i.id));

  const now = new Date();

  const portfolio = investments.map((inv) => {
    const { investedValue, currentValue } = computeInvestmentValue(inv, now);
    const pnl        = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return { ...serializeInvestment(attachSplit(inv, splits.get(inv.id))), investedValue, currentValue, pnl, pnlPercent };
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

function serializeInvestment(inv: InvestmentWithRelations) {
  const { collateral, ...rest } = inv;
  return {
    ...rest,
    quantity:       Number(inv.quantity),
    buyPrice:       Number(inv.buyPrice),
    currentPrice:   Number(inv.currentPrice),
    monthlyAmount:  inv.monthlyAmount  ? Number(inv.monthlyAmount)  : null,
    nextMonthlyAmount: inv.nextMonthlyAmount != null ? Number(inv.nextMonthlyAmount) : null,
    maturityAmount: inv.maturityAmount ? Number(inv.maturityAmount) : null,
    interestRate:   inv.interestRate   ? Number(inv.interestRate)   : null,
    address:                  collateral?.address ?? null,
    ownershipPercent:         collateral?.ownershipPercent         ? Number(collateral.ownershipPercent)         : null,
    expectedAppreciationRate: collateral?.expectedAppreciationRate ? Number(collateral.expectedAppreciationRate) : null,
    linkedLoans: inv.linkedLoans?.map((l) => ({
      ...l,
      remainingBalance: Number(l.remainingBalance),
      interestRate:     Number(l.interestRate),
      emi:              Number(l.emi),
      principal:        Number(l.principal),
    })),
  };
}
