import { prisma } from '../lib/prisma';
import { syncLoanBalance } from '../schedule/progress';
import { createError } from '../middleware/error.middleware';
import { calculateEMISplit } from './loan.service';
import { findCategory } from '../lib/paymentCategory';
import { currentMonth, dueItems, instalmentFor, RECURRING_INVESTMENT_TYPES } from '../schedule/dueItems';
import type { DueItem } from '../schedule/types';
import { copySplitToTransactions } from '../lib/ownershipSplit';

export const recurringTypes = RECURRING_INVESTMENT_TYPES;
export { currentMonth, instalmentFor };
export function monthWindow(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw createError('Invalid month', 400);
  const [year, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`, next: `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}` };
}
export interface MonthlyPlanRow {
  id: string; type: string; name: string; amount: number; status: string; dueDate?: string;
  accountId?: string | null; creditCardId?: string;
  /** Family member who pays this row; null when nobody is set. */
  memberId?: string | null;
  /** Loans only: borrower and payer differ, or one of them is unset. */
  shared?: boolean;
  /** Card statements only: amount already paid this month, and what is still owed. */
  paidAmount?: number;
  remaining?: number;
  /** OwnershipSplit: the other person and the % of this row they pay. */
  split?: { memberId: string; pct: number };
  /** Card statements only: set when the row comes from a saved monthly statement. */
  statementId?: string;
}
// Plan row type → OwnershipSplit entity type, for every type the split model covers.
export const SPLIT_ENTITY: Record<string, 'INVESTMENT' | 'LOAN' | 'BILL' | 'CARD_EMI'> = { INVESTMENT: 'INVESTMENT', LOAN: 'LOAN', BILL: 'BILL', CARD_EMI: 'CARD_EMI' };

/** A due item as a month-plan row (the API shape Home and the payment lists use). */
export function toPlanRow(i: DueItem): MonthlyPlanRow {
  const statement = i.itemType === 'CARD_STATEMENT';
  return {
    id: i.itemId, type: statement ? 'CREDIT_CARD' : i.itemType, name: i.name, amount: i.amount, status: i.status,
    dueDate: i.dueDate ?? undefined, accountId: i.accountId, creditCardId: i.creditCardId ?? undefined, memberId: i.payerMemberId,
    ...(i.shared !== undefined && { shared: i.shared }),
    ...(statement && { paidAmount: i.paidAmount, remaining: i.remaining }),
    ...(i.split && { split: i.split }),
    ...(i.statementId && { statementId: i.statementId }),
  };
}

/** Everything due in one month, from the schedule engine. */
export async function getMonthlyPlan(userId: string, month = currentMonth()) {
  monthWindow(month);
  const rows = (await dueItems(userId, month, month)).map(toPlanRow);
  return { month, rows, ...summarizeRows(rows) };
}
export function summarizeRows(input: { type: string; amount: number; status: string; paidAmount?: number; remaining?: number }[]) {
  // A part-paid card statement counts its paid part as paid and the rest as pending.
  const rows = input.flatMap(r => r.status === 'PENDING' && r.paidAmount
    ? [{ ...r, amount: r.paidAmount, status: 'PAID' }, { ...r, amount: r.remaining ?? r.amount - r.paidAmount }]
    : [r]);
  const sum = (status?: string, type?: string) => rows.filter(r => (!status || r.status === status) && (!type || r.type === type)).reduce((s, r) => s + r.amount, 0);
  return { scheduled: sum(), paid: sum('PAID'), skipped: sum('SKIPPED'), remaining: sum('PENDING'), loans: sum('PENDING', 'LOAN'), creditCards: sum('PENDING', 'CREDIT_CARD') + sum('PENDING', 'CARD_EMI'), investments: sum('PENDING', 'INVESTMENT'), bills: sum('PENDING', 'BILL') };
}
export interface PaymentOptions {
  /** `YYYY-MM`: this month (default) or last month, for an overdue instalment. */
  month?: string;
  /** A different amount than scheduled (part payment, or a changed SIP amount). */
  amount?: number;
  /** `YYYY-MM-DD` the money actually left the account; defaults to now. */
  paidDate?: string;
}
export function previousMonth(month = currentMonth()) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
/** The plan for `month` (default: this month) plus the months either side, as Home's Still to pay shows them. */
export async function getPlanAround(userId: string, month = currentMonth()) {
  const [current, next, previous] = await Promise.all([getMonthlyPlan(userId, month), getMonthlyPlan(userId, monthWindow(month).next), getMonthlyPlan(userId, previousMonth(month))]);
  return { current, next, previous };
}
export async function decideMonthlyPayment(userId: string, type: 'LOAN' | 'INVESTMENT', id: string, status: 'PAID' | 'SKIPPED', accountId?: string, options: PaymentOptions = {}) {
  const month = options.month ?? currentMonth();
  if (month !== currentMonth() && month !== previousMonth()) throw createError('Only this month or last month can be recorded', 400);
  if (options.amount !== undefined && !(options.amount > 0)) throw createError('Amount must be positive', 400);
  const paidOn = options.paidDate ? new Date(`${options.paidDate}T12:00:00+05:30`) : new Date();
  if (Number.isNaN(paidOn.getTime()) || paidOn.getTime() > Date.now() + 86_400_000) throw createError('Paid date is not valid', 400);
  const emiCategory = await findCategory(userId, type === 'LOAN' ? 'Loan EMI' : 'Investment');
  const wealthCategory = type === 'LOAN' ? await findCategory(userId, 'Wealth Creation') : null;
  try {
    return await prisma.$transaction(async tx => {
      const loan = type === 'LOAN' ? await tx.loan.findFirst({ where: { id, userId, isActive: true } }) : null;
      const inv = type === 'INVESTMENT' ? await tx.investment.findFirst({ where: { id, userId } }) : null;
      if (!loan && !inv) throw createError('Payment item not found', 404);
      if (inv && inv.recurringActive === false) throw createError('Recurring contributions are inactive', 400);
      if (inv && !recurringTypes.includes(inv.assetType)) throw createError('This investment has no monthly installment', 400);
      const start = loan?.startDate ?? inv!.purchaseDate;
      if (currentMonth(start) > month || (inv?.maturityDate && currentMonth(inv.maturityDate) < month)) throw createError('No installment due this month', 400);
      const split = loan ? calculateEMISplit(Number(loan.remainingBalance), options.amount ?? Number(loan.emi), Number(loan.interestRate)) : null;
      const instalment = inv ? instalmentFor(inv, month) : null;
      if (instalment?.paused && status === 'PAID' && options.amount === undefined) throw createError('This instalment is paused for that month', 400);
      const amount = split?.actualPayment ?? options.amount ?? instalment!.amount;
      if (amount <= 0) throw createError('No payment amount configured', 400);
      const sourceAccount = accountId || loan?.bankAccountId || inv?.bankAccountId;
      if (sourceAccount && !await tx.account.findFirst({ where: { id: sourceAccount, userId } })) throw createError('Account not found', 404);
      const key = { userId, entityType: type, entityId: id, month };
      const existing = await tx.monthlyPayment.findUnique({ where: { userId_entityType_entityId_month: key } });
      if (existing?.status === 'PAID') throw createError('Already paid this month', 409);
      if (existing?.status === 'SKIPPED' && status === 'SKIPPED') return existing;
      // Reserve the unique monthly slot before any money is moved.
      if (existing) await tx.monthlyPayment.delete({ where: { id: existing.id } });
      const event = await tx.monthlyPayment.create({ data: { ...key, status, amount } });
      if (status === 'SKIPPED') return event;
      const transactions = [];
      const portions = loan && split ? [
        { amount: split.interestPortion, description: `EMI Interest: ${loan.name}`, categoryId: emiCategory, isWealthTransfer: false },
        { amount: split.principalPortion, description: `EMI Principal: ${loan.name}`, categoryId: loan.linkedInvestmentId ? wealthCategory : emiCategory, isWealthTransfer: !!loan.linkedInvestmentId },
      ] : [{ amount, description: `${inv!.assetType}: ${inv!.assetName}`, categoryId: emiCategory, isWealthTransfer: false }];
      for (const portion of portions.filter(p => p.amount > 0)) transactions.push(await tx.transaction.create({ data: { userId, type: 'EXPENSE', kind: loan ? 'DEBT' : 'SAVE', sourceType: type, sourceId: id, period: month, ...portion, accountId: sourceAccount, memberId: loan?.payerMemberId ?? loan?.memberId ?? inv?.memberId, date: paidOn, isRecurring: true } }));
      if (loan && split) {
        await tx.loan.update({ where: { id }, data: { isActive: !split.isPaidOff } });
        await syncLoanBalance(tx, id);
      }
      if (loan && split?.isPaidOff) await tx.loanEvent.create({ data: { userId, loanId: id, type: 'CLOSED', date: paidOn, balanceBefore: loan.remainingBalance, balanceAfter: 0, note: `Last EMI (${month})` } });
      if (inv?.assetType === 'RECURRING_DEPOSIT') await tx.investment.update({ where: { id }, data: { quantity: { increment: 1 } } });
      if (sourceAccount) await tx.account.update({ where: { id: sourceAccount }, data: { balance: { decrement: amount } } });
      await copySplitToTransactions(tx, userId, loan ? 'LOAN' : 'INVESTMENT', id, transactions.map(t => t.id));
      await tx.monthlyPayment.update({ where: { id: event.id }, data: { transactionIds: transactions.map(t => t.id) } });
      return { ...event, amount, transactions, transaction: transactions[0], isPaidOff: split?.isPaidOff ?? false };
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw createError('Already recorded this month', 409);
    throw error;
  }
}
