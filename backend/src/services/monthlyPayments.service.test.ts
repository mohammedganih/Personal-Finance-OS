import { describe, it, expect } from 'vitest';
import { currentMonth, monthWindow, summarizeRows } from './monthlyPayments.service';
import { calculateEMISplit } from './loan.service';

describe('monthly planning', () => {
  it('uses the household calendar at the UTC month boundary', () => {
    expect(currentMonth(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10');
  });
  it('handles leap February and December rollover', () => {
    expect(monthWindow('2028-02').end).toBe('2028-02-29');
    expect(monthWindow('2026-12').next).toBe('2027-01');
    expect(() => monthWindow('2026-13')).toThrow();
  });
  it('subtracts paid and skipped payments from cash still required', () => {
    const totals = summarizeRows([
      { type: 'LOAN', amount: 5000, status: 'PAID' },
      { type: 'INVESTMENT', amount: 1000, status: 'SKIPPED' },
      { type: 'LOAN', amount: 2000, status: 'PENDING' },
      { type: 'BILL', amount: 750, status: 'PENDING' },
    ]);
    expect(totals).toEqual({ scheduled: 8750, paid: 5000, skipped: 1000, remaining: 2750, loans: 2000, creditCards: 0, investments: 0, bills: 750 });
  });
  it('caps final installment principal so ledger matches cash withdrawn', () => {
    const split = calculateEMISplit(3000, 5000, 12);
    expect(split.principalPortion).toBe(3000);
    expect(split.principalPortion + split.interestPortion).toBe(split.actualPayment);
  });
});
