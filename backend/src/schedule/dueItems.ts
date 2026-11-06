import { prisma } from '../lib/prisma';
import { cardEMIAmountInMonth, dateInMonth, indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { calculateEMISplit } from '../services/loan.service';
import { parseDateOnly } from '../lib/billSchedule';
import { billOccurrencesInRange } from './bills';
import type { DueItem, DueStatus, ItemType } from './types';

// The schedule engine: every loan EMI, card EMI, SIP/RD/gold instalment, card
// statement and bill, per month, with its paid status. Home's month sheet and
// Still to pay, the funding plan, reminders and the "upcoming" lists on Loans,
// Accounts and Investments all read from dueItems().

export const RECURRING_INVESTMENT_TYPES = ['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'];
const SPLIT_ENTITY: Partial<Record<ItemType, 'INVESTMENT' | 'LOAN' | 'BILL' | 'CARD_EMI'>> = { INVESTMENT: 'INVESTMENT', LOAN: 'LOAN', BILL: 'BILL', CARD_EMI: 'CARD_EMI' };

/** `YYYY-MM` of today (or `now`) in India time. */
export function currentMonth(now = new Date()) {
  return indiaDateKey(now).slice(0, 7);
}

/** Months from `from` to `to` inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 240; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** A SIP/RD/gold scheme's instalment for a month: paused, or the (possibly changed) amount. */
export function instalmentFor(inv: { monthlyAmount: unknown; pauseFrom?: string | null; pauseUntil?: string | null; nextMonthlyAmount?: unknown; nextAmountFrom?: string | null }, month: string) {
  const paused = !!inv.pauseFrom && month >= inv.pauseFrom && (!inv.pauseUntil || month <= inv.pauseUntil);
  const changed = !!inv.nextAmountFrom && inv.nextMonthlyAmount != null && month >= inv.nextAmountFrom;
  return { paused, amount: Number(changed ? inv.nextMonthlyAmount : inv.monthlyAmount) || 0 };
}

/** A recorded paid/skipped/auto instalment, as the engine reads it. */
export interface StatusRecord { itemType: ItemType; itemId: string; period: string; status: Exclude<DueStatus, 'PENDING'>; amount: number; paidDate: Date | null }

const ENTITY_TO_ITEM: Record<string, ItemType> = { LOAN: 'LOAN', INVESTMENT: 'INVESTMENT', CARD_EMI: 'CARD_EMI', CREDIT_CARD: 'CARD_STATEMENT' };

async function loadStatusRecords(userId: string, periods: string[]): Promise<StatusRecord[]> {
  const rows = await prisma.monthlyPayment.findMany({ where: { userId, month: { in: periods } } });
  return rows.filter((r) => ENTITY_TO_ITEM[r.entityType]).map((r) => ({
    itemType: ENTITY_TO_ITEM[r.entityType], itemId: r.entityId, period: r.month,
    status: r.status as StatusRecord['status'], amount: Number(r.amount), paidDate: r.createdAt,
  }));
}

export interface DueItemsOptions {
  /** Only these item types (default: all). */
  types?: ItemType[];
  now?: Date;
}

/** Every due item from `fromMonth` to `toMonth` (inclusive), ordered by month then due date. */
export async function dueItems(userId: string, fromMonth: string, toMonth: string, options: DueItemsOptions = {}): Promise<DueItem[]> {
  const now = options.now ?? new Date();
  const today = currentMonth(now);
  const months = monthsBetween(fromMonth, toMonth);
  if (!months.length) return [];
  const want = (t: ItemType) => !options.types || options.types.includes(t);

  const [loans, investments, records, cards, cardEmis, statements, closeEvents, splits] = await Promise.all([
    want('LOAN') ? prisma.loan.findMany({ where: { userId } }) : [],
    want('INVESTMENT') ? prisma.investment.findMany({ where: { userId, assetType: { in: RECURRING_INVESTMENT_TYPES as never } } }) : [],
    loadStatusRecords(userId, Array.from(new Set([...months, today]))),
    prisma.creditCard.findMany({ where: { userId, isActive: true } }),
    want('CARD_EMI') ? prisma.cardEMI.findMany({ where: { userId }, include: { creditCard: true } }) : [],
    want('CARD_STATEMENT') ? prisma.cardStatement.findMany({ where: { userId }, select: { id: true, creditCardId: true, month: true, totalDue: true, dueDate: true } }) : [],
    want('LOAN') ? prisma.loanEvent.findMany({ where: { userId, type: 'CLOSED' }, select: { loanId: true, date: true }, orderBy: { date: 'desc' } }) : [],
    prisma.ownershipSplit.findMany({ where: { userId, entityType: { in: ['INVESTMENT', 'LOAN', 'BILL', 'CARD_EMI'] } } }),
  ]);
  const record = (type: ItemType, id: string, period: string) => records.find((r) => r.itemType === type && r.itemId === id && r.period === period);
  const cardMember = new Map(cards.map((c) => [c.id, c.memberId]));
  // When each loan closed: its latest CLOSED history entry; older loans fall back to their last edit.
  const closedOn = new Map<string, Date>();
  for (const e of closeEvents) if (!closedOn.has(e.loanId)) closedOn.set(e.loanId, e.date);

  const items: DueItem[] = [];
  const base = (r?: StatusRecord) => ({
    status: (r?.status ?? 'PENDING') as DueStatus,
    paidAmount: r && r.status !== 'SKIPPED' ? r.amount : 0,
    paidDate: r?.paidDate ? indiaDateKey(r.paidDate) : null,
    split: null,
  });

  for (const month of months) {
    const past = month < today;
    for (const loan of loans) {
      const rec = record('LOAN', loan.id, month);
      // A loan closed since then was still being repaid in earlier months.
      const closedLater = !loan.isActive && past && month < currentMonth(closedOn.get(loan.id) ?? loan.updatedAt);
      if (!rec && ((!loan.isActive && !closedLater) || currentMonth(loan.startDate) > month)) continue;
      let balance = Number(loan.remainingBalance);
      // Later months assume this month's pending EMI is paid on schedule.
      if (month > today && currentMonth(loan.startDate) <= today && !record('LOAN', loan.id, today)) {
        balance = calculateEMISplit(balance, Number(loan.emi), Number(loan.interestRate)).newBalance;
      }
      const split = calculateEMISplit(balance, Number(loan.emi), Number(loan.interestRate));
      if (!rec && !closedLater && split.actualPayment <= 0) continue;
      // Earlier months without a record show the scheduled EMI, not one worked out from today's balance.
      const scheduled = past ? Number(loan.emi) : split.actualPayment;
      items.push({
        ...base(rec), itemType: 'LOAN', itemId: loan.id, name: loan.name, period: month,
        dueDate: dateInMonth(month, loan.paymentDay ?? Number(indiaDateKey(loan.startDate).slice(8))),
        amount: rec ? rec.amount : scheduled, payerMemberId: loan.payerMemberId ?? loan.memberId,
        shared: !loan.memberId || !loan.payerMemberId || loan.memberId !== loan.payerMemberId,
        accountId: loan.bankAccountId, creditCardId: null, autoDebit: false,
      });
    }

    for (const inv of investments) {
      const rec = record('INVESTMENT', inv.id, month);
      const instalment = instalmentFor(inv, month);
      if (!rec && (inv.recurringActive === false || instalment.paused || currentMonth(inv.purchaseDate) > month || (inv.maturityDate && currentMonth(inv.maturityDate) < month) || instalment.amount <= 0)) continue;
      items.push({
        ...base(rec), itemType: 'INVESTMENT', itemId: inv.id, name: inv.assetName, period: month,
        dueDate: dateInMonth(month, inv.paymentDay ?? Number(indiaDateKey(inv.purchaseDate).slice(8))),
        amount: rec ? rec.amount : instalment.amount, payerMemberId: inv.memberId,
        accountId: inv.bankAccountId, creditCardId: null, autoDebit: false,
      });
    }

    if (want('CARD_STATEMENT')) for (const card of cards) {
      const name = `${card.cardName} - statement balance`;
      const common = { itemType: 'CARD_STATEMENT' as const, itemId: card.id, name, period: month, payerMemberId: card.memberId, accountId: card.bankAccountId, creditCardId: card.id, autoDebit: false, split: null };
      const rec = record('CARD_STATEMENT', card.id, month);
      const paid = rec && rec.status !== 'SKIPPED' ? rec.amount : 0;
      const paidDate = rec?.paidDate ? indiaDateKey(rec.paidDate) : null;
      // A saved statement for this month is the real figure.
      const saved = statements.find((st) => st.creditCardId === card.id && st.month === month);
      if (saved) {
        const total = Number(saved.totalDue);
        if (total <= 0 && !paid) continue;
        const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
        items.push({ ...common, amount: total, paidAmount: paid, paidDate, remaining, status: remaining <= 0 ? 'PAID' : 'PENDING', dueDate: indiaDateKey(saved.dueDate), statementId: saved.id });
        continue;
      }
      // The card's own fields mirror a saved statement, which shows in its own month.
      if (statements.some((st) => st.creditCardId === card.id && st.month === indiaDateKey(card.dueDate).slice(0, 7))) continue;
      const dueDate = indiaDateKey(card.dueDate);
      // The balance typed on the card is due once; unknown future spending isn't repeated.
      const dueMonth = dueDate.slice(0, 7) < today ? today : dueDate.slice(0, 7);
      if (dueMonth !== month) continue;
      const outstanding = Number(card.outstanding);
      if (outstanding <= 0 && !paid) continue;
      items.push({ ...common, amount: outstanding + paid, paidAmount: paid, paidDate, remaining: outstanding, status: outstanding <= 0 ? 'PAID' : 'PENDING', dueDate });
    }

    for (const emi of cardEmis) {
      if (!emi.creditCard.isActive) continue;
      const rec = record('CARD_EMI', emi.id, month);
      const currentRec = record('CARD_EMI', emi.id, today);
      const payment = cardEMIAmountInMonth(emi, emi.creditCard, month, today, currentRec?.status);
      if (!rec && !payment) continue;
      items.push({
        ...base(rec), itemType: 'CARD_EMI', itemId: emi.id, name: `${emi.itemName} (${emi.creditCard.cardName})`, period: month,
        dueDate: payment?.dueDate ?? dateInMonth(month, Number(indiaDateKey(emi.creditCard.dueDate).slice(8))),
        amount: rec ? rec.amount : payment!.amount, payerMemberId: emi.memberId ?? emi.creditCard.memberId,
        accountId: emi.creditCard.bankAccountId, creditCardId: emi.creditCardId, autoDebit: false,
      });
    }
  }

  if (want('BILL')) {
    const [ly, lm] = months[months.length - 1].split('-').map(Number);
    const start = parseDateOnly(`${months[0]}-01`);
    const end = new Date(ly, lm, 0);
    for (const occ of await billOccurrencesInRange(userId, start, end)) {
      if (occ.status === 'PAUSED') continue;
      const bill = occ.bill;
      const done = occ.status === 'PAID' || occ.status === 'SKIPPED';
      items.push({
        itemType: 'BILL', itemId: bill.id, name: bill.name, period: occ.dueKey.slice(0, 7), dueDate: occ.dueKey, amount: occ.amount,
        payerMemberId: bill.memberId ?? (bill.creditCardId ? cardMember.get(bill.creditCardId) ?? null : null),
        accountId: bill.accountId, creditCardId: bill.creditCardId, autoDebit: bill.autoDebit,
        status: done ? (occ.status as DueStatus) : 'PENDING', paidAmount: occ.status === 'PAID' ? occ.amount : 0, paidDate: null,
        split: null, billStatus: occ.status,
      });
    }
  }

  for (const item of items) {
    const entity = SPLIT_ENTITY[item.itemType];
    const sp = entity && splits.find((x) => x.entityType === entity && x.entityId === item.itemId);
    if (sp && sp.secondaryMemberId !== item.payerMemberId) item.split = { memberId: sp.secondaryMemberId, pct: Math.round((100 - Number(sp.ratio)) * 100) / 100 };
  }
  // Order within a month follows the old plan (loans, investments, cards, card EMIs, bills); callers sort by date as they need.
  return items.sort((a, b) => a.period.localeCompare(b.period));
}
