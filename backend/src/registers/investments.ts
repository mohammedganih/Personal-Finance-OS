import { prisma } from '../lib/prisma';
import { indiaDateKey } from '../lib/cardPaymentSchedule';
import { getBalanceSheet, getMonthFlows } from '../metrics';
import { currentMonth, dueItems, instalmentFor, RECURRING_INVESTMENT_TYPES, monthsBetween } from '../schedule/dueItems';
import { paidInByInvestment } from '../schedule/paidIn';
import { computeInvestmentValue, valueStatus, type ValueStatus } from '../services/investment.service';
import { toPlanRow, MonthlyPlanRow } from '../services/monthlyPayments.service';

// The Savings & investments register: every holding with its value, what went
// in, the monthly contribution, whose it is and when it matures; recurring
// ones (SIP, RD, gold scheme) also show this month's instalment.

export interface HoldingRow {
  id: string; name: string; assetType: string; platform: string | null;
  value: number; invested: number;
  /** SIPs and mutual funds: where the value comes from (paid in, or entered plus instalments since). */
  valuation: ValueStatus | null;
  /** Monthly contribution for an active SIP / RD / gold scheme. */
  monthly: number | null;
  memberId: string | null; split: { memberId: string; pct: number } | null;
  maturityDate: string | null; maturityAmount: number | null;
  /** Gold schemes and RDs: what the maturity amount adds on top of the instalments. */
  maturityBonus: number | null;
  recurring: boolean; autoDebit: boolean; bankAccountId: string | null;
  next: (MonthlyPlanRow & { period: string }) | null;
}
export interface InvestmentRegister {
  totals: { totalValue: number; addedThisMonth: number; nextMaturity: { name: string; date: string; amount: number | null } | null };
  holdings: HoldingRow[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function getInvestmentRegister(userId: string, now = new Date()): Promise<InvestmentRegister> {
  const month = currentMonth(now);
  const today = indiaDateKey(now);
  const [investments, paidIn, due, sheet, flows, splits] = await Promise.all([
    prisma.investment.findMany({ where: { userId }, include: { collateral: { select: { ownershipPercent: true } } }, orderBy: { createdAt: 'asc' } }),
    paidInByInvestment(userId, now),
    dueItems(userId, month, month, { types: ['INVESTMENT'], now }),
    getBalanceSheet(userId, now),
    getMonthFlows(userId, month),
    prisma.ownershipSplit.findMany({ where: { userId, entityType: 'INVESTMENT' } }),
  ]);

  const holdings: HoldingRow[] = investments.map((inv) => {
    const { investedValue, currentValue } = computeInvestmentValue(inv, now, paidIn.get(inv.id));
    const recurring = RECURRING_INVESTMENT_TYPES.includes(inv.assetType);
    const item = due.find((d) => d.itemId === inv.id);
    const sp = splits.find((s) => s.entityId === inv.id);
    const maturityAmount = inv.maturityAmount != null ? Number(inv.maturityAmount) : null;
    // Scheme total: every scheduled instalment from the start to the maturity month.
    const scheduledTotal = recurring && inv.maturityDate
      ? monthsBetween(currentMonth(inv.purchaseDate), currentMonth(inv.maturityDate)).reduce((s, m) => s + (instalmentFor(inv, m).paused ? 0 : instalmentFor(inv, m).amount), 0)
      : null;
    return {
      id: inv.id, name: inv.assetName, assetType: inv.assetType, platform: inv.platform,
      value: round(currentValue), invested: round(investedValue),
      monthly: recurring && inv.recurringActive !== false ? Number(inv.monthlyAmount ?? 0) || null : null,
      memberId: inv.memberId,
      split: sp && sp.secondaryMemberId !== inv.memberId ? { memberId: sp.secondaryMemberId, pct: round(100 - Number(sp.ratio)) } : null,
      maturityDate: inv.maturityDate ? indiaDateKey(inv.maturityDate) : null,
      maturityAmount,
      maturityBonus: maturityAmount != null && scheduledTotal != null && maturityAmount > scheduledTotal ? round(maturityAmount - scheduledTotal) : null,
      recurring, autoDebit: inv.autoDebit, bankAccountId: inv.bankAccountId,
      next: item ? { ...toPlanRow(item), period: item.period } : null,
      valuation: valueStatus(inv, paidIn.get(inv.id), now),
    };
  }).sort((a, b) => b.value - a.value);

  const upcoming = holdings.filter((h) => h.maturityDate && h.maturityDate >= today).sort((a, b) => a.maturityDate!.localeCompare(b.maturityDate!))[0];
  return {
    totals: {
      totalValue: sheet.investmentValue,
      addedThisMonth: flows.save,
      nextMaturity: upcoming ? { name: upcoming.name, date: upcoming.maturityDate!, amount: upcoming.maturityAmount } : null,
    },
    holdings,
  };
}
