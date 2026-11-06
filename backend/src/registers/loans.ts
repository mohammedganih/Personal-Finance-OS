import { prisma } from '../lib/prisma';
import { indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { getBalanceSheet } from '../metrics';
import { currentMonth, dueItems } from '../schedule/dueItems';
import { calculateEMISplit } from '../services/loan.service';
import { lastDebtEnds } from '../services/whereWeStand.service';
import { toPlanRow, MonthlyPlanRow } from '../services/monthlyPayments.service';
import type { DueItem } from '../schedule/types';

// The Loans register: one row per loan with who pays, the EMI, what is left,
// when it ends and this month's instalment; totals from the metrics module and
// the schedule engine.

export interface Amortisation { monthsLeft: number | null; endsMonth: string | null; interestLeft: number | null; repaidSoFar: number }
export interface LoanRow {
  id: string; name: string; loanType: string; lender: string | null; isActive: boolean;
  borrowerMemberId: string | null; payerMemberId: string | null;
  /** Owner of the bank account the EMI is debited from, when that is not the payer. */
  debitedFromMemberId: string | null;
  bankAccountId: string | null; autoDebit: boolean;
  emi: number; interestRate: number; principal: number; left: number;
  amortisation: Amortisation;
  /** Closed loans: the month it was closed. */
  closedMonth: string | null;
  /** This month's instalment (or next month's if none is due this month), as the payment buttons take it. */
  next: (MonthlyPlanRow & { period: string }) | null;
}
export interface LoanRegister {
  totals: { totalLeft: number; monthlyEmis: number; debtFreeMonth: string | null; debtFreeName: string | null };
  loans: LoanRow[];
  closed: LoanRow[];
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Pure: months left, the month it ends and the interest still to pay, by amortising the balance at the EMI and rate. */
export function amortise(balance: number, emi: number, annualRate: number, fromMonth: string): Omit<Amortisation, 'repaidSoFar'> {
  let left = balance, interest = 0;
  for (let n = 0; n < 600; n++) {
    if (left <= 0.5) return { monthsLeft: n, endsMonth: n ? shiftMonth(fromMonth, n - 1) : null, interestLeft: round(interest) };
    const split = calculateEMISplit(left, emi, annualRate);
    if (split.principalPortion <= 0) break;
    interest += split.interestPortion;
    left = split.newBalance;
  }
  return { monthsLeft: null, endsMonth: null, interestLeft: null };
}

export async function getLoanRegister(userId: string, now = new Date()): Promise<LoanRegister> {
  const month = currentMonth(now);
  const [loans, accounts, closeEvents, due, sheet, ends] = await Promise.all([
    prisma.loan.findMany({ where: { userId }, orderBy: [{ isActive: 'desc' }, { remainingBalance: 'desc' }] }),
    prisma.account.findMany({ where: { userId }, select: { id: true, memberId: true } }),
    prisma.loanEvent.findMany({ where: { userId, type: 'CLOSED' }, orderBy: { date: 'desc' }, select: { loanId: true, date: true } }),
    dueItems(userId, month, shiftMonth(month, 1), { types: ['LOAN'], now }),
    getBalanceSheet(userId, now),
    lastDebtEnds(userId, now),
  ]);
  const owner = new Map(accounts.map((a) => [a.id, a.memberId]));
  const closedOn = new Map<string, Date>();
  for (const e of closeEvents) if (!closedOn.has(e.loanId)) closedOn.set(e.loanId, e.date);
  const nextFor = (id: string): LoanRow['next'] => {
    const mine = due.filter((d: DueItem) => d.itemId === id);
    const pick = mine.find((d) => d.period === month) ?? mine[0];
    return pick ? { ...toPlanRow(pick), period: pick.period } : null;
  };

  const rows: LoanRow[] = loans.map((l) => {
    const payer = l.payerMemberId ?? l.memberId;
    const accountOwner = l.bankAccountId ? owner.get(l.bankAccountId) ?? null : null;
    const left = Number(l.remainingBalance);
    const repaidSoFar = round(Math.max(0, Number(l.principal) - left));
    return {
      id: l.id, name: l.name, loanType: l.loanType, lender: l.lender, isActive: l.isActive,
      borrowerMemberId: l.memberId, payerMemberId: payer,
      debitedFromMemberId: accountOwner && payer && accountOwner !== payer ? accountOwner : null,
      bankAccountId: l.bankAccountId, autoDebit: l.autoDebit,
      emi: Number(l.emi), interestRate: Number(l.interestRate), principal: Number(l.principal), left,
      amortisation: l.isActive ? { ...amortise(left, Number(l.emi), Number(l.interestRate), month), repaidSoFar } : { monthsLeft: 0, endsMonth: null, interestLeft: 0, repaidSoFar },
      closedMonth: l.isActive ? null : indiaDateKey(closedOn.get(l.id) ?? l.updatedAt).slice(0, 7),
      next: l.isActive ? nextFor(l.id) : null,
    };
  });
  const monthlyEmis = round(due.filter((d) => d.period === month && d.status !== 'SKIPPED').reduce((s, d) => s + d.amount, 0));
  return {
    totals: { totalLeft: sheet.loanDebt, monthlyEmis, debtFreeMonth: ends?.month ?? null, debtFreeName: ends?.name ?? null },
    loans: rows.filter((r) => r.isActive),
    closed: rows.filter((r) => !r.isActive),
  };
}
