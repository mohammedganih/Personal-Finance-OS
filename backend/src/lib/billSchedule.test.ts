import { describe, it, expect } from 'vitest';
import {
  BillScheduleShape,
  MaterializedEvent,
  effectiveStatus,
  isOccurrenceSuspended,
  monthlyEquivalent,
  nextDueDate,
  occurrencesBetween,
  parseDateOnly,
  projectOccurrences,
  toDateKey,
} from './billSchedule';

function schedule(overrides: Partial<BillScheduleShape> = {}): BillScheduleShape {
  return {
    frequency: 'MONTHLY',
    customIntervalDays: null,
    startDate: parseDateOnly('2026-01-15'),
    endDate: null,
    status: 'ACTIVE',
    pausedUntil: null,
    ...overrides,
  };
}

function keys(dates: Date[]): string[] {
  return dates.map(toDateKey);
}

describe('monthlyEquivalent', () => {
  it('normalizes every frequency to monthly cash-flow impact', () => {
    expect(monthlyEquivalent('MONTHLY', 1200, null)).toBe(1200);
    expect(monthlyEquivalent('EVERY_2_MONTHS', 1200, null)).toBe(600);
    expect(monthlyEquivalent('QUARTERLY', 1200, null)).toBe(400);
    expect(monthlyEquivalent('EVERY_4_MONTHS', 1200, null)).toBe(300);
    expect(monthlyEquivalent('HALF_YEARLY', 1200, null)).toBe(200);
    expect(monthlyEquivalent('YEARLY', 1200, null)).toBe(100);
  });

  it('scales week-based cycles by average days per month', () => {
    expect(monthlyEquivalent('WEEKLY', 700, null)).toBeCloseTo(700 * (30.4375 / 7), 5);
    expect(monthlyEquivalent('BIWEEKLY', 700, null)).toBeCloseTo(700 * (30.4375 / 14), 5);
    expect(monthlyEquivalent('CUSTOM', 900, 30)).toBeCloseTo(900 * (30.4375 / 30), 5);
  });

  it('treats one-time commitments as zero recurring impact', () => {
    expect(monthlyEquivalent('ONE_TIME', 5000, null)).toBe(0);
  });
});

describe('occurrencesBetween', () => {
  it('projects monthly occurrences on the anchor day', () => {
    const dates = occurrencesBetween(schedule(), parseDateOnly('2026-01-01'), parseDateOnly('2026-04-30'));
    expect(keys(dates)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('clamps a day-31 anchor to short months without drifting', () => {
    const dates = occurrencesBetween(
      schedule({ startDate: parseDateOnly('2026-01-31') }),
      parseDateOnly('2026-01-01'),
      parseDateOnly('2026-05-31')
    );
    // 2026 is not a leap year; the anchor day must snap back to 31 in May.
    expect(keys(dates)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('projects weekly and custom day intervals with fast-forward far from the anchor', () => {
    const weekly = occurrencesBetween(
      schedule({ frequency: 'WEEKLY', startDate: parseDateOnly('2020-01-06') }),
      parseDateOnly('2026-07-01'),
      parseDateOnly('2026-07-31')
    );
    // Mondays: the 2020 anchor was a Monday, so six years later they still are.
    expect(keys(weekly)).toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27']);
    expect(weekly.every((d) => d.getDay() === 1)).toBe(true);

    const custom = occurrencesBetween(
      schedule({ frequency: 'CUSTOM', customIntervalDays: 45, startDate: parseDateOnly('2026-01-01') }),
      parseDateOnly('2026-01-01'),
      parseDateOnly('2026-06-30')
    );
    expect(keys(custom)).toEqual(['2026-01-01', '2026-02-15', '2026-04-01', '2026-05-16', '2026-06-30']);
  });

  it('respects endDate and ranges before the start', () => {
    const ended = occurrencesBetween(
      schedule({ endDate: parseDateOnly('2026-02-28') }),
      parseDateOnly('2026-01-01'),
      parseDateOnly('2026-12-31')
    );
    expect(keys(ended)).toEqual(['2026-01-15', '2026-02-15']);

    const before = occurrencesBetween(schedule(), parseDateOnly('2025-01-01'), parseDateOnly('2025-12-31'));
    expect(before).toEqual([]);
  });

  it('emits a ONE_TIME bill exactly once, only when in range', () => {
    const oneTime = schedule({ frequency: 'ONE_TIME', startDate: parseDateOnly('2026-03-10') });
    expect(keys(occurrencesBetween(oneTime, parseDateOnly('2026-03-01'), parseDateOnly('2026-03-31')))).toEqual(['2026-03-10']);
    expect(occurrencesBetween(oneTime, parseDateOnly('2026-04-01'), parseDateOnly('2026-12-31'))).toEqual([]);
  });

  it('projects yearly bills across years', () => {
    const dates = occurrencesBetween(
      schedule({ frequency: 'YEARLY', startDate: parseDateOnly('2024-03-20') }),
      parseDateOnly('2025-01-01'),
      parseDateOnly('2028-12-31')
    );
    expect(keys(dates)).toEqual(['2025-03-20', '2026-03-20', '2027-03-20', '2028-03-20']);
  });
});

describe('pause semantics', () => {
  const today = parseDateOnly('2026-07-08');

  it('auto-reactivates once pausedUntil has passed', () => {
    expect(effectiveStatus({ status: 'PAUSED', pausedUntil: parseDateOnly('2026-07-01') }, today)).toBe('ACTIVE');
    expect(effectiveStatus({ status: 'PAUSED', pausedUntil: parseDateOnly('2026-08-01') }, today)).toBe('PAUSED');
    expect(effectiveStatus({ status: 'PAUSED', pausedUntil: null }, today)).toBe('PAUSED');
  });

  it('suspends only future occurrences inside the pause window', () => {
    const bill = { status: 'PAUSED' as const, pausedUntil: parseDateOnly('2026-08-31') };
    expect(isOccurrenceSuspended(bill, parseDateOnly('2026-06-15'), today)).toBe(false); // past keeps real status
    expect(isOccurrenceSuspended(bill, parseDateOnly('2026-08-15'), today)).toBe(true);
    expect(isOccurrenceSuspended(bill, parseDateOnly('2026-09-15'), today)).toBe(false); // after resume
  });

  it('suspends indefinitely when pausedUntil is null', () => {
    const bill = { status: 'PAUSED' as const, pausedUntil: null };
    expect(isOccurrenceSuspended(bill, parseDateOnly('2027-12-15'), today)).toBe(true);
  });
});

describe('projectOccurrences', () => {
  const today = parseDateOnly('2026-07-08');
  const bill = { ...schedule({ startDate: parseDateOnly('2026-05-08') }), amount: 499 };

  it('merges materialized events with the raw schedule', () => {
    const events = new Map<string, MaterializedEvent>([
      ['2026-05-08', { status: 'PAID', amount: 450, paidDate: parseDateOnly('2026-05-08') }],
      ['2026-06-08', { status: 'SKIPPED', amount: null, paidDate: null }],
    ]);
    const projected = projectOccurrences(bill, events, parseDateOnly('2026-05-01'), parseDateOnly('2026-08-31'), today);
    expect(projected.map((o) => [o.dueKey, o.status, o.amount])).toEqual([
      ['2026-05-08', 'PAID', 450], // actual paid amount wins over scheduled amount
      ['2026-06-08', 'SKIPPED', 499],
      ['2026-07-08', 'DUE_TODAY', 499],
      ['2026-08-08', 'UPCOMING', 499],
    ]);
  });

  it('marks unpaid past occurrences as overdue', () => {
    const projected = projectOccurrences(bill, new Map(), parseDateOnly('2026-05-01'), parseDateOnly('2026-06-30'), today);
    expect(projected.map((o) => o.status)).toEqual(['OVERDUE', 'OVERDUE']);
  });
});

describe('nextDueDate', () => {
  const today = parseDateOnly('2026-07-08');

  it('returns the first unresolved, unsuspended occurrence', () => {
    const bill = schedule({ startDate: parseDateOnly('2026-07-10') });
    expect(toDateKey(nextDueDate(bill, new Map(), today)!)).toBe('2026-07-10');

    const events = new Map<string, MaterializedEvent>([
      ['2026-07-10', { status: 'PAID', amount: 100, paidDate: today }],
    ]);
    expect(toDateKey(nextDueDate(bill, events, today)!)).toBe('2026-08-10');

    const skipTwo = new Map<string, MaterializedEvent>([
      ['2026-07-10', { status: 'SKIPPED', amount: null, paidDate: null }],
      ['2026-08-10', { status: 'SKIPPED', amount: null, paidDate: null }],
    ]);
    expect(toDateKey(nextDueDate(bill, skipTwo, today)!)).toBe('2026-09-10');
  });

  it('jumps past a pause window and returns null for indefinite pauses or archived bills', () => {
    const paused = schedule({
      startDate: parseDateOnly('2026-07-10'),
      status: 'PAUSED',
      pausedUntil: parseDateOnly('2026-08-31'),
    });
    expect(toDateKey(nextDueDate(paused, new Map(), today)!)).toBe('2026-09-10');

    const indefinite = schedule({ startDate: parseDateOnly('2026-07-10'), status: 'PAUSED' });
    expect(nextDueDate(indefinite, new Map(), today)).toBeNull();

    const archived = schedule({ status: 'ARCHIVED' });
    expect(nextDueDate(archived, new Map(), today)).toBeNull();
  });

  it('returns null for a settled ONE_TIME bill and an ended bill', () => {
    const oneTime = schedule({ frequency: 'ONE_TIME', startDate: parseDateOnly('2026-07-10') });
    const paid = new Map<string, MaterializedEvent>([
      ['2026-07-10', { status: 'PAID', amount: 100, paidDate: today }],
    ]);
    expect(nextDueDate(oneTime, paid, today)).toBeNull();

    const ended = schedule({ endDate: parseDateOnly('2026-06-30') });
    expect(nextDueDate(ended, new Map(), today)).toBeNull();
  });
});
