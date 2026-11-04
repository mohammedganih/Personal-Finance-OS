import { cardEMIAmountInMonth, indiaDateKey, dateInMonth } from '../lib/cardPaymentSchedule';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { calculateEMISplit } from './loan.service';
import { findCategory } from '../lib/paymentCategory';
import { getBillsCalendar } from './bill.service';

export const recurringTypes = ['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'];
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}
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
}
// Plan row type → OwnershipSplit entity type, for every type the split model covers.
export const SPLIT_ENTITY: Record<string, 'INVESTMENT'> = { INVESTMENT: 'INVESTMENT' };
export async function getMonthlyPlan(userId: string, month = currentMonth()) {
  const window = monthWindow(month);
  const [loans, investments, events, bills, cards, cardEmis] = await Promise.all([
    prisma.loan.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId, assetType: { in: ['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'] } } }),
    prisma.monthlyPayment.findMany({ where: { userId, month: { in: [month, currentMonth()] } } }),
    getBillsCalendar(userId, window.start, window.end),
    prisma.creditCard.findMany({ where: { userId, isActive: true } }),
    prisma.cardEMI.findMany({ where: { userId }, include: { creditCard: true } }),
  ]);
  const rows: MonthlyPlanRow[] = [];
  const cardMember = new Map(cards.map(c => [c.id, c.memberId]));
  for (const loan of loans) {
    const event = events.find(e => e.month === month && e.entityType === 'LOAN' && e.entityId === loan.id);
    if (!event && (!loan.isActive || currentMonth(loan.startDate) > month)) continue;
    let balance = Number(loan.remainingBalance);
    // Next month assumes this month's pending EMI is paid on schedule.
    if (month > currentMonth() && currentMonth(loan.startDate) <= currentMonth()) {
      const currentEvent = events.find(e => e.month === currentMonth() && e.entityType === 'LOAN' && e.entityId === loan.id);
      if (!currentEvent) balance = calculateEMISplit(balance, Number(loan.emi), Number(loan.interestRate)).newBalance;
    }
    const split = calculateEMISplit(balance, Number(loan.emi), Number(loan.interestRate));
    if (!event && split.actualPayment <= 0) continue;
    rows.push({ id: loan.id, type: 'LOAN', name: loan.name, amount: event ? Number(event.amount) : split.actualPayment, status: event?.status ?? 'PENDING', accountId: loan.bankAccountId, memberId: loan.payerMemberId ?? loan.memberId, shared: !loan.memberId || !loan.payerMemberId || loan.memberId !== loan.payerMemberId, dueDate: dateInMonth(month, loan.paymentDay ?? Number(indiaDateKey(loan.startDate).slice(8))) });
  }
  for (const inv of investments) {
    const event = events.find(e => e.month === month && e.entityType === 'INVESTMENT' && e.entityId === inv.id);
    if (!event && (inv.recurringActive === false || currentMonth(inv.purchaseDate) > month || (inv.maturityDate && currentMonth(inv.maturityDate) < month) || Number(inv.monthlyAmount) <= 0)) continue;
    rows.push({ id: inv.id, type: 'INVESTMENT', name: inv.assetName, amount: event ? Number(event.amount) : Number(inv.monthlyAmount), status: event?.status ?? 'PENDING', accountId: inv.bankAccountId, memberId: inv.memberId, dueDate: dateInMonth(month, inv.paymentDay ?? Number(indiaDateKey(inv.purchaseDate).slice(8))) });
  }
  for (const card of cards) {
    const dueDate = indiaDateKey(card.dueDate);
    // Full saved statement balance is due once; unknown future spending isn't repeated.
    const dueMonth = dueDate.slice(0, 7) < currentMonth() ? currentMonth() : dueDate.slice(0, 7);
    if (dueMonth !== month) continue;
    // Payments already made against this statement are kept on its MonthlyPayment
    // record, so the statement stays visible (as paid / part paid) after paying.
    const event = events.find(e => e.month === month && e.entityType === 'CREDIT_CARD' && e.entityId === card.id);
    const paid = event ? Number(event.amount) : 0;
    const outstanding = Number(card.outstanding);
    if (outstanding <= 0 && !paid) continue;
    rows.push({ id: card.id, type: 'CREDIT_CARD', name: `${card.cardName} - statement balance`, amount: outstanding + paid, paidAmount: paid, remaining: outstanding, status: outstanding <= 0 ? 'PAID' : 'PENDING', dueDate, accountId: card.bankAccountId, creditCardId: card.id, memberId: card.memberId });
  }
  for (const emi of cardEmis) {
    if (!emi.creditCard.isActive) continue;
    const event = events.find(e => e.month === month && e.entityType === 'CARD_EMI' && e.entityId === emi.id);
    const currentEvent = events.find(e => e.month === currentMonth() && e.entityType === 'CARD_EMI' && e.entityId === emi.id);
    const payment = cardEMIAmountInMonth(emi, emi.creditCard, month, currentMonth(), currentEvent?.status);
    if (!event && !payment) continue;
    rows.push({ id: emi.id, type: 'CARD_EMI', accountId: emi.creditCard.bankAccountId, creditCardId: emi.creditCardId, memberId: emi.memberId ?? emi.creditCard.memberId, name: `${emi.itemName} (${emi.creditCard.cardName})`, amount: event ? Number(event.amount) : payment!.amount, status: event?.status ?? 'PENDING', dueDate: payment?.dueDate ?? dateInMonth(month, Number(indiaDateKey(emi.creditCard.dueDate).slice(8))) });
  }
  for (const bill of bills) {
    if (bill.status === 'PAUSED') continue;
    rows.push({ id: bill.billId, type: 'BILL', name: bill.name, amount: bill.amount, accountId: bill.accountId, creditCardId: bill.creditCardId ?? undefined, memberId: bill.memberId ?? (bill.creditCardId ? cardMember.get(bill.creditCardId) ?? null : null), status: ['PAID', 'SKIPPED'].includes(bill.status) ? bill.status : 'PENDING', dueDate: bill.dueDate });
  }
  const splits = await prisma.ownershipSplit.findMany({ where: { userId, entityType: { in: Array.from(new Set(Object.values(SPLIT_ENTITY))) } } });
  for (const r of rows) {
    const sp = SPLIT_ENTITY[r.type] && splits.find(x => x.entityType === SPLIT_ENTITY[r.type] && x.entityId === r.id);
    if (sp && sp.secondaryMemberId !== r.memberId) r.split = { memberId: sp.secondaryMemberId, pct: Math.round((100 - Number(sp.ratio)) * 100) / 100 };
  }
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
      const amount = split?.actualPayment ?? options.amount ?? Number(inv!.monthlyAmount);
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
      for (const portion of portions.filter(p => p.amount > 0)) transactions.push(await tx.transaction.create({ data: { userId, type: 'EXPENSE', ...portion, accountId: sourceAccount, memberId: loan?.payerMemberId ?? loan?.memberId ?? inv?.memberId, date: paidOn, isRecurring: true } }));
      if (loan && split) await tx.loan.update({ where: { id }, data: { remainingBalance: split.newBalance, isActive: !split.isPaidOff } });
      if (inv?.assetType === 'RECURRING_DEPOSIT') await tx.investment.update({ where: { id }, data: { quantity: { increment: 1 } } });
      if (sourceAccount) await tx.account.update({ where: { id: sourceAccount }, data: { balance: { decrement: amount } } });
      await tx.monthlyPayment.update({ where: { id: event.id }, data: { transactionIds: transactions.map(t => t.id) } });
      return { ...event, amount, transactions, transaction: transactions[0], isPaidOff: split?.isPaidOff ?? false };
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw createError('Already recorded this month', 409);
    throw error;
  }
}
