import { BillFrequency, BillStatus } from '@prisma/client';
import { addMonthsClamped } from './dateMath';

/**
 * Pure scheduling engine for Recurring Bills.
 *
 * A bill stores only its rule (startDate + frequency + optional endDate) plus
 * materialized PAID/SKIPPED events; everything else -- next due date, calendar
 * occurrences, month forecasts -- is projected here. Keeping this pure (no
 * Prisma, no clock reads; `today` is always a parameter) is what makes the
 * whole forecasting layer unit-testable.
 */

export interface BillScheduleShape {
  frequency: BillFrequency;
  customIntervalDays: number | null;
  startDate: Date;
  endDate: Date | null;
  status: BillStatus;
  pausedUntil: Date | null;
}

export interface MaterializedEvent {
  status: 'PAID' | 'SKIPPED';
  amount: number | null;
  paidDate: Date | null;
}

export type ProjectedStatus = 'PAID' | 'SKIPPED' | 'PAUSED' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

export interface ProjectedOccurrence {
  dueDate: Date;
  dueKey: string; // yyyy-MM-dd, the join key against bill_occurrences.dueDate
  status: ProjectedStatus;
  amount: number; // actual paid amount for PAID, scheduled amount otherwise
}

const MONTH_STEPS: Partial<Record<BillFrequency, number>> = {
  MONTHLY: 1,
  EVERY_2_MONTHS: 2,
  QUARTERLY: 3,
  EVERY_4_MONTHS: 4,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

const DAY_STEPS: Partial<Record<BillFrequency, number>> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
};

const AVG_DAYS_PER_MONTH = 30.4375; // 365.25 / 12

// ─── Date helpers (local-time, day granularity) ──────────────────────────────

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parses 'YYYY-MM-DD' as local midnight (new Date(str) would give UTC midnight). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole days from a to b, DST-proof (computed on UTC day numbers). */
export function diffDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

// ─── Frequency math ──────────────────────────────────────────────────────────

function dayStepOf(frequency: BillFrequency, customIntervalDays: number | null): number | null {
  if (frequency === 'CUSTOM') return Math.max(1, customIntervalDays ?? 30);
  return DAY_STEPS[frequency] ?? null;
}

/**
 * Normalizes any billing amount to its monthly cash-flow impact.
 * ONE_TIME contributes 0 -- it isn't a recurring commitment.
 */
export function monthlyEquivalent(
  frequency: BillFrequency,
  amount: number,
  customIntervalDays: number | null
): number {
  const monthStep = MONTH_STEPS[frequency];
  if (monthStep) return amount / monthStep;
  const dayStep = dayStepOf(frequency, customIntervalDays);
  if (dayStep) return amount * (AVG_DAYS_PER_MONTH / dayStep);
  return 0; // ONE_TIME
}

// ─── Occurrence projection ───────────────────────────────────────────────────

/**
 * All scheduled due dates of `bill` within [rangeStart, rangeEnd] (inclusive,
 * day granularity). Ignores pause state and materialized events -- this is the
 * raw rule. Month-family cycles anchor on startDate's day-of-month with
 * end-of-month clamping (a bill anchored on the 31st is due Feb 28).
 */
export function occurrencesBetween(
  bill: Pick<BillScheduleShape, 'frequency' | 'customIntervalDays' | 'startDate' | 'endDate'>,
  rangeStart: Date,
  rangeEnd: Date,
  cap = 1000
): Date[] {
  const start = startOfDay(bill.startDate);
  const from = startOfDay(rangeStart);
  let to = startOfDay(rangeEnd);
  if (bill.endDate) {
    const end = startOfDay(bill.endDate);
    if (end < to) to = end;
  }
  if (to < from || to < start) return [];

  if (bill.frequency === 'ONE_TIME') {
    return start >= from && start <= to ? [start] : [];
  }

  const result: Date[] = [];
  const dayStep = dayStepOf(bill.frequency, bill.customIntervalDays);

  if (dayStep) {
    // Fast-forward to the first occurrence at or after `from`.
    const gap = diffDays(start, from);
    const k = gap > 0 ? Math.ceil(gap / dayStep) : 0;
    let cursor = addDays(start, k * dayStep);
    while (cursor <= to && result.length < cap) {
      result.push(cursor);
      cursor = addDays(cursor, dayStep);
    }
    return result;
  }

  const monthStep = MONTH_STEPS[bill.frequency]!;
  const anchorDay = start.getDate();
  // Fast-forward close to `from` (one step early to be safe around clamping).
  const monthsGap = (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth());
  let i = Math.max(0, (Math.floor(monthsGap / monthStep) - 1) * monthStep);
  while (result.length < cap) {
    const occ = i === 0 ? start : startOfDay(addMonthsClamped(start, i, anchorDay));
    if (occ > to) break;
    if (occ >= from) result.push(occ);
    i += monthStep;
  }
  return result;
}

/** PAUSED bills auto-reactivate once pausedUntil has passed. */
export function effectiveStatus(bill: Pick<BillScheduleShape, 'status' | 'pausedUntil'>, today: Date): BillStatus {
  if (bill.status === 'PAUSED' && bill.pausedUntil && startOfDay(bill.pausedUntil) < startOfDay(today)) {
    return 'ACTIVE';
  }
  return bill.status;
}

/**
 * Whether an occurrence on `dueDate` is suspended by a pause. Past occurrences
 * keep their real status (paid / missed) -- pausing is forward-looking only.
 */
export function isOccurrenceSuspended(
  bill: Pick<BillScheduleShape, 'status' | 'pausedUntil'>,
  dueDate: Date,
  today: Date
): boolean {
  if (effectiveStatus(bill, today) !== 'PAUSED') return false;
  const due = startOfDay(dueDate);
  if (due < startOfDay(today)) return false;
  return !bill.pausedUntil || due <= startOfDay(bill.pausedUntil);
}

/**
 * Projects the bill's occurrences in [rangeStart, rangeEnd], merging the raw
 * schedule with materialized PAID/SKIPPED events (keyed by yyyy-MM-dd due
 * date) and the pause window.
 */
export function projectOccurrences(
  bill: BillScheduleShape & { amount: number },
  events: Map<string, MaterializedEvent>,
  rangeStart: Date,
  rangeEnd: Date,
  today: Date
): ProjectedOccurrence[] {
  const todayKey = toDateKey(startOfDay(today));
  return occurrencesBetween(bill, rangeStart, rangeEnd).map((dueDate) => {
    const dueKey = toDateKey(dueDate);
    const event = events.get(dueKey);
    let status: ProjectedStatus;
    if (event?.status === 'PAID') status = 'PAID';
    else if (event?.status === 'SKIPPED') status = 'SKIPPED';
    else if (isOccurrenceSuspended(bill, dueDate, today)) status = 'PAUSED';
    else if (dueKey === todayKey) status = 'DUE_TODAY';
    else if (dueDate < startOfDay(today)) status = 'OVERDUE';
    else status = 'UPCOMING';
    const amount = event?.status === 'PAID' && event.amount != null ? event.amount : bill.amount;
    return { dueDate, dueKey, status, amount };
  });
}

/**
 * The next occurrence from `today` (inclusive) that still needs action: not
 * already paid or skipped, and not inside a pause window. Null when nothing is
 * coming up within `horizonMonths` (archived, ended, indefinitely paused, or a
 * ONE_TIME bill already settled).
 */
export function nextDueDate(
  bill: BillScheduleShape,
  events: Map<string, MaterializedEvent>,
  today: Date,
  horizonMonths = 27
): Date | null {
  if (bill.status === 'ARCHIVED') return null;
  const from = startOfDay(today);
  const horizon = startOfDay(addMonthsClamped(from, horizonMonths, from.getDate()));
  for (const occ of occurrencesBetween(bill, from, horizon)) {
    const event = events.get(toDateKey(occ));
    if (event) continue;
    if (isOccurrenceSuspended(bill, occ, today)) continue;
    return occ;
  }
  return null;
}
