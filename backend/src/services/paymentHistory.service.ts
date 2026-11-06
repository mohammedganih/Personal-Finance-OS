import { prisma } from '../lib/prisma';
import { loadOccurrenceRows } from '../schedule/bills';
import { createError } from '../middleware/error.middleware';
import { indiaDateKey } from '../lib/cardPaymentSchedule';
import { currentMonth, previousMonth, toPlanRow } from './monthlyPayments.service';
import { dueItems } from '../schedule/dueItems';
import { getBillReminders } from './bill.service';
import { getLoanEvents } from './loanEvents.service';

export type HistoryType = 'LOAN' | 'INVESTMENT' | 'CARD_EMI' | 'CREDIT_CARD' | 'BILL';
export interface HistoryEntry {
  key: string; kind: 'PAID' | 'SKIPPED' | 'PREPAYMENT' | 'RATE_CHANGE' | 'CLOSED';
  month: string | null; dueDate: string | null; date: string; amount: number | null;
  canUndo: boolean; eventId?: string; note?: string | null;
}

async function assertOwned(userId: string, type: HistoryType, id: string) {
  const where = { id, userId };
  const found = type === 'LOAN' ? await prisma.loan.findFirst({ where })
    : type === 'INVESTMENT' ? await prisma.investment.findFirst({ where })
    : type === 'CARD_EMI' ? await prisma.cardEMI.findFirst({ where })
    : type === 'CREDIT_CARD' ? await prisma.creditCard.findFirst({ where })
    : await prisma.recurringBill.findFirst({ where });
  if (!found) throw createError('Item not found', 404);
}

/** Every recorded payment, skip and loan change for one item, newest first, with what can be undone. */
export async function getPaymentHistory(userId: string, type: HistoryType, id: string): Promise<HistoryEntry[]> {
  await assertOwned(userId, type, id);
  if (type === 'BILL') {
    const rows = (await loadOccurrenceRows(userId, { billIds: [id] })).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
    return rows.map(o => ({
      key: o.id, kind: o.status === 'SKIPPED' ? 'SKIPPED' : 'PAID', month: indiaDateKey(o.dueDate).slice(0, 7), dueDate: indiaDateKey(o.dueDate),
      date: (o.paidDate ?? o.createdAt).toISOString(), amount: o.amount != null ? Number(o.amount) : null, canUndo: true, note: o.notes,
    }));
  }
  const records = await prisma.dueStatus.findMany({ where: { userId, itemType: type === 'CREDIT_CARD' ? 'CARD_STATEMENT' : type, itemId: id }, orderBy: { period: 'desc' } });
  // Loans, card EMIs and card bills move a running balance, so only the latest payment can be undone.
  const latestPaid = records.find(r => r.status !== 'SKIPPED')?.period;
  const entries: HistoryEntry[] = records.map(r => ({
    key: r.id, kind: r.status === 'SKIPPED' ? 'SKIPPED' : 'PAID', month: r.period, dueDate: null, date: (r.paidDate ?? r.createdAt).toISOString(), amount: Number(r.amount ?? 0),
    canUndo: r.status === 'SKIPPED' || type === 'INVESTMENT' || r.period === latestPaid,
  }));
  if (type === 'LOAN') {
    const events = await getLoanEvents(userId, id);
    const undoable = events.find(e => e.type === 'PREPAYMENT' || e.type === 'RATE_CHANGE')?.id;
    for (const e of events) {
      entries.push({
        key: e.id, eventId: e.id, kind: e.type as HistoryEntry['kind'], month: indiaDateKey(e.date).slice(0, 7), dueDate: null, date: e.date.toISOString(),
        amount: e.amount, canUndo: e.id === undoable, note: e.type === 'RATE_CHANGE' ? `${e.oldRate}% → ${e.newRate}%${e.oldEmi !== e.newEmi ? `, EMI ₹${e.oldEmi} → ₹${e.newEmi}` : ''}` : e.note,
      });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export interface Reminder {
  key: string; kind: 'OVERDUE' | 'DUE_SOON' | 'MATURITY'; type: string; id: string; name: string;
  amount: number | null; dueDate: string; daysLeft: number; memberId: string | null; href: string;
}
const HREF: Record<string, string> = { LOAN: '/loans', CARD_EMI: '/credit-cards', CREDIT_CARD: '/credit-cards', INVESTMENT: '/investments', BILL: '/bills' };
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * In-app reminders: EMIs, SIPs and card bills due within `soonDays` or overdue
 * (this month and last), bill reminders (each bill's own reminder days), and
 * investments maturing within 30 days.
 */
export async function getReminders(userId: string, soonDays = 3): Promise<Reminder[]> {
  const today = indiaDateKey(new Date());
  const [due, bills, maturing] = await Promise.all([
    dueItems(userId, previousMonth(), currentMonth(), { types: ['LOAN', 'INVESTMENT', 'CARD_EMI', 'CARD_STATEMENT'] }),
    getBillReminders(userId),
    prisma.investment.findMany({ where: { userId, maturityDate: { not: null } }, select: { id: true, assetName: true, maturityDate: true, maturityAmount: true, memberId: true } }),
  ]);
  const out: Reminder[] = [];
  for (const r of due.map(toPlanRow)) {
    if (r.status !== 'PENDING' || r.type === 'BILL' || !r.dueDate) continue;
    const left = days(today, r.dueDate);
    if (left > soonDays) continue;
    out.push({ key: `${r.type}:${r.id}:${r.dueDate}`, kind: left < 0 ? 'OVERDUE' : 'DUE_SOON', type: r.type, id: r.id, name: r.name,
      amount: r.type === 'CREDIT_CARD' ? r.remaining ?? r.amount : r.amount, dueDate: r.dueDate, daysLeft: left, memberId: r.memberId ?? null, href: HREF[r.type] ?? '/dashboard' });
  }
  for (const b of bills) {
    out.push({ key: `BILL:${b.billId}:${b.dueDate}`, kind: b.dueInDays < 0 ? 'OVERDUE' : 'DUE_SOON', type: 'BILL', id: b.billId, name: b.name,
      amount: b.amount, dueDate: b.dueDate, daysLeft: b.dueInDays, memberId: null, href: '/bills' });
  }
  for (const inv of maturing) {
    const due = indiaDateKey(inv.maturityDate!);
    const left = days(today, due);
    if (left < 0 || left > 30) continue;
    out.push({ key: `MATURITY:${inv.id}`, kind: 'MATURITY', type: 'INVESTMENT', id: inv.id, name: `${inv.assetName} matures`,
      amount: inv.maturityAmount != null ? Number(inv.maturityAmount) : null, dueDate: due, daysLeft: left, memberId: inv.memberId, href: '/investments' });
  }
  const rank = { OVERDUE: 0, DUE_SOON: 1, MATURITY: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.dueDate.localeCompare(b.dueDate));
}
