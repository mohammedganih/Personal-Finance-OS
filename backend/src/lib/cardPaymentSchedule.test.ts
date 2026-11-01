import { describe, it, expect } from 'vitest';
import { firstCardEMIDueDate, nextCardEMIDueDate, cardEMIAmountInMonth } from './cardPaymentSchedule';
const card = { statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') };
const purchase = (date: string, tenureMonths = 1, emisPaid = 0) => ({ startDate: new Date(date), tenureMonths, emisPaid, emiAmount: 7799, isArchived: false });
describe('credit card due month', () => {
  it('bills September purchases after the statement on October 29', () => {
    expect(firstCardEMIDueDate(purchase('2026-09-20'), card)).toBe('2026-10-29');
    expect(cardEMIAmountInMonth(purchase('2026-09-20'), card, '2026-09', '2026-09')).toBeNull();
    expect(cardEMIAmountInMonth(purchase('2026-09-20'), card, '2026-10', '2026-10')).toEqual({ amount: 7799, dueDate: '2026-10-29' });
    expect(cardEMIAmountInMonth(purchase('2026-09-20'), card, '2026-11', '2026-10')).toBeNull();
  });
  it('respects paid installment counts on multi-month loans', () => {
    expect(nextCardEMIDueDate(purchase('2026-04-04', 9, 6), card, '2026-10')).toBe('2026-10-29');
    expect(nextCardEMIDueDate(purchase('2026-06-09', 24, 4), card, '2026-10')).toBe('2026-10-29');
    expect(cardEMIAmountInMonth(purchase('2026-04-04', 9, 6), card, '2027-01', '2026-10')).toBeNull();
  });
  it('excludes completed and archived installments', () => {
    expect(nextCardEMIDueDate(purchase('2026-09-20', 1, 1), card, '2026-10')).toBeNull();
    expect(cardEMIAmountInMonth({ ...purchase('2026-09-20'), isArchived: true }, card, '2026-10', '2026-10')).toBeNull();
  });
  it('handles the statement/due cycle across December and clamps February', () => {
    const cycle = { statementDate: new Date('2026-12-25'), dueDate: new Date('2027-01-05') };
    expect(firstCardEMIDueDate(purchase('2026-12-26'), cycle)).toBe('2027-02-05');
    const monthEndCard = { statementDate: null, dueDate: new Date('2026-01-31') };
    expect(firstCardEMIDueDate(purchase('2028-02-20'), monthEndCard)).toBe('2028-02-29');
    expect(cardEMIAmountInMonth(purchase('2028-02-20', 3), monthEndCard, '2028-03', '2028-02')?.dueDate).toBe('2028-03-31');
  });
  it('keeps overdue installments and defers late payments into the next month', () => {
    const late = purchase('2026-03-01', 12, 4);
    expect(nextCardEMIDueDate(late, card, '2026-10')).toBe('2026-10-29');
    expect(cardEMIAmountInMonth(late, card, '2026-11', '2026-10', 'PAID')?.dueDate).toBe('2026-11-29');
  });
});
