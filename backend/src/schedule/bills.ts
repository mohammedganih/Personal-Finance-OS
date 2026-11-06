import { Prisma, RecurringBill } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  BillScheduleShape,
  MaterializedEvent,
  ProjectedStatus,
  effectiveStatus,
  projectOccurrences,
  startOfDay,
  toDateKey,
} from '../lib/billSchedule';

// Bill occurrences, projected once from each bill's rule plus its recorded
// paid/skipped events. The schedule engine, the Bills page and the reminders
// all read bills through here.

export const BILL_INCLUDE = {
  member: { select: { id: true, name: true, color: true, emoji: true } },
  account: { select: { id: true, name: true, type: true } },
  creditCard: { select: { id: true, cardName: true, lastFourDigits: true, bank: true } },
} satisfies Prisma.RecurringBillInclude;

export type BillWithRelations = Prisma.RecurringBillGetPayload<{ include: typeof BILL_INCLUDE }>;
export type EventMap = Map<string, MaterializedEvent>;

export interface OccurrenceRow {
  id: string;
  billId: string;
  dueDate: Date;
  status: 'PAID' | 'SKIPPED';
  amount: Prisma.Decimal | null;
  paidDate: Date | null;
  transactionId: string | null;
  notes: string | null;
}

export interface FlatOccurrence {
  bill: BillWithRelations;
  dueDate: Date;
  dueKey: string;
  status: ProjectedStatus;
  amount: number;
}

export const EMPTY_EVENTS: EventMap = new Map();

export function toSchedule(bill: RecurringBill): BillScheduleShape & { amount: number } {
  return {
    frequency: bill.frequency,
    customIntervalDays: bill.customIntervalDays,
    startDate: bill.startDate,
    endDate: bill.endDate,
    status: bill.status,
    pausedUntil: bill.pausedUntil,
    amount: Number(bill.amount),
  };
}

export function buildEventMaps(occurrences: OccurrenceRow[]): Map<string, EventMap> {
  const byBill = new Map<string, EventMap>();
  for (const occ of occurrences) {
    let events = byBill.get(occ.billId);
    if (!events) {
      events = new Map();
      byBill.set(occ.billId, events);
    }
    events.set(toDateKey(occ.dueDate), {
      status: occ.status,
      amount: occ.amount != null ? Number(occ.amount) : null,
      paidDate: occ.paidDate,
    });
  }
  return byBill;
}

export async function loadOccurrenceRows(userId: string, where: { billId?: { in: string[] }; dueDate?: { gte: Date; lte: Date } } = {}): Promise<OccurrenceRow[]> {
  return (await prisma.billOccurrence.findMany({ where: { userId, ...where } })) as OccurrenceRow[];
}

export async function loadBillsWithEvents(userId: string) {
  const [bills, occurrences] = await Promise.all([
    prisma.recurringBill.findMany({ where: { userId }, include: BILL_INCLUDE }),
    loadOccurrenceRows(userId),
  ]);
  return { bills, eventsByBill: buildEventMaps(occurrences) };
}

/** Every occurrence of every non-archived bill in [rangeStart, rangeEnd], earliest first. */
export function projectAll(
  bills: BillWithRelations[],
  eventsByBill: Map<string, EventMap>,
  rangeStart: Date,
  rangeEnd: Date,
  today: Date
): FlatOccurrence[] {
  const flat: FlatOccurrence[] = [];
  for (const bill of bills) {
    if (bill.status === 'ARCHIVED') continue;
    const projected = projectOccurrences(toSchedule(bill), eventsByBill.get(bill.id) ?? EMPTY_EVENTS, rangeStart, rangeEnd, today);
    for (const occ of projected) flat.push({ bill, ...occ });
  }
  flat.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return flat;
}

/**
 * The bills calendar for a date range: projected occurrences of live bills,
 * plus the recorded history of archived bills (they stop projecting, but what
 * was paid or skipped in the window still shows).
 */
export async function billOccurrencesInRange(userId: string, start: Date, end: Date, today = startOfDay(new Date())) {
  const { bills, eventsByBill } = await loadBillsWithEvents(userId);
  const flat = projectAll(bills, eventsByBill, start, end, today);
  const archivedIds = bills.filter((b) => b.status === 'ARCHIVED').map((b) => b.id);
  if (archivedIds.length > 0) {
    const billById = new Map(bills.map((b) => [b.id, b]));
    for (const row of await loadOccurrenceRows(userId, { billId: { in: archivedIds }, dueDate: { gte: start, lte: end } })) {
      const bill = billById.get(row.billId)!;
      flat.push({ bill, dueDate: row.dueDate, dueKey: toDateKey(row.dueDate), status: row.status, amount: row.amount != null ? Number(row.amount) : Number(bill.amount) });
    }
  }
  return flat
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .map((occ) => ({ ...occ, effectiveBillStatus: effectiveStatus(occ.bill, today) }));
}
