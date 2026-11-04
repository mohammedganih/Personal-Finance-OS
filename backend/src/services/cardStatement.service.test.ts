import { describe, it, expect } from 'vitest';
import { cycleForDueMonth, dueMonthForDate, emiOnStatement, statementStatus, addDays } from './cardStatement.service';
import { cardSplits } from './monthSummary.service';
import type { MonthlyPlanRow } from './monthlyPayments.service';

// Statement on the 11th, due on the 29th (same month), like ICICI Sapphiro.
const sameMonth = { statementDay: 11, dueDay: 29 };
// Statement on the 25th, due on the 15th of the next month.
const nextMonth = { statementDay: 25, dueDay: 15 };

describe('card billing cycle', () => {
  it('works out the period, statement date and due date for a due month', () => {
    expect(cycleForDueMonth(sameMonth, '2026-10')).toEqual({ month: '2026-10', periodStart: '2026-09-12', statementDate: '2026-10-11', dueDate: '2026-10-29' });
    expect(cycleForDueMonth(nextMonth, '2026-11')).toEqual({ month: '2026-11', periodStart: '2026-09-26', statementDate: '2026-10-25', dueDate: '2026-11-15' });
  });

  it('places a purchase on the statement it bills on', () => {
    expect(dueMonthForDate(sameMonth, '2026-10-11')).toBe('2026-10'); // on the statement day
    expect(dueMonthForDate(sameMonth, '2026-09-19')).toBe('2026-10');
    expect(dueMonthForDate(sameMonth, '2026-10-12')).toBe('2026-11');
    expect(dueMonthForDate(nextMonth, '2026-10-20')).toBe('2026-11');
    expect(dueMonthForDate(nextMonth, '2026-10-26')).toBe('2026-12');
    expect(dueMonthForDate(sameMonth, '2026-12-20')).toBe('2027-01'); // across the year end
  });

  it('clamps short months', () => {
    expect(cycleForDueMonth({ statementDay: 31, dueDay: 20 }, '2026-03').statementDate).toBe('2026-02-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('finds the EMIs billed on a statement', () => {
    const card = { statementDate: new Date('2026-06-11T00:00:00Z'), dueDate: new Date('2026-06-29T00:00:00Z') };
    const emi = { startDate: new Date('2026-04-04T00:00:00Z'), tenureMonths: 9, emisPaid: 7 };
    expect(emiOnStatement(emi, card, '2026-04')).toBe(true);
    expect(emiOnStatement(emi, card, '2026-12')).toBe(true);
    expect(emiOnStatement(emi, card, '2027-01')).toBe(false);
    expect(emiOnStatement(emi, card, '2026-03')).toBe(false);
  });

  it('reports due / part paid / paid', () => {
    expect(statementStatus(1000, 0)).toBe('DUE');
    expect(statementStatus(1000, 400)).toBe('PART_PAID');
    expect(statementStatus(1000, 1000)).toBe('PAID');
    expect(statementStatus(0, 0)).toBe('PAID');
  });
});

describe('Home card spending from real data', () => {
  const statementRow = (extra: Partial<MonthlyPlanRow> = {}): MonthlyPlanRow => ({ id: 'c1', type: 'CREDIT_CARD', name: 'Card - statement balance', amount: 20000, status: 'PENDING', creditCardId: 'c1', memberId: 'm1', ...extra });
  const emi: MonthlyPlanRow = { id: 'e1', type: 'CARD_EMI', name: 'Phone', amount: 5000, status: 'PENDING', creditCardId: 'c1', memberId: 'm1' };
  const spend = (s: Partial<{ oneOff: number; linked: number; paidOff: number }>) => [{ creditCardId: 'c1', name: 'Card', memberId: 'm1', oneOff: 0, linked: 0, paidOff: 0, ...s }];

  it('uses a saved statement, less EMIs and purchases counted elsewhere', () => {
    const rows = [statementRow({ statementId: 's1' }), emi];
    const [c] = cardSplits(rows, rows, spend({ oneOff: 3000, linked: 10000 }));
    expect(c).toMatchObject({ source: 'STATEMENT', statement: 20000, deducted: 15000, spending: 5000 });
  });

  it('uses entered card purchases when no statement is saved yet', () => {
    const rows = [statementRow(), emi];
    const [c] = cardSplits(rows, rows, spend({ oneOff: 3000 }));
    expect(c).toMatchObject({ source: 'EXPENSES', spending: 3000, needsStatementUpdate: false });
  });

  it('falls back to the balance on the card when nothing else is entered', () => {
    const rows = [statementRow(), emi];
    expect(cardSplits(rows, rows, [])[0]).toMatchObject({ source: 'CARD', spending: 15000 });
  });

  it('adds purchases paid off this month, even without a statement row', () => {
    const rows = [statementRow({ statementId: 's1' }), emi];
    expect(cardSplits(rows, rows, spend({ paidOff: 800 }))[0].spending).toBe(15800);
    const [only] = cardSplits([], [], spend({ paidOff: 800, oneOff: 200 }));
    expect(only).toMatchObject({ source: 'EXPENSES', statement: 200, spending: 1000 });
  });

  it('shows the statement building now (EMIs + purchases) when the card has no statement row', () => {
    const rows = [{ ...emi, dueDate: '2026-11-29' }];
    const [c] = cardSplits([], rows, spend({ oneOff: 2598 }));
    expect(c).toMatchObject({ source: 'EXPENSES', statement: 7598, deducted: 5000, spending: 2598, dueDate: '2026-11-29' });
  });
});
