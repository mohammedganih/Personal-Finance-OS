import { describe, it, expect } from 'vitest';
import { firstCardEMIDueDate, nextCardEMIDueDate } from './cardPaymentSchedule';
import { billedInstalments, cardEMIDueDateIn, cardEMIInstalmentIndex } from '../schedule/progress';
const card = { statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') };
const purchase = (date: string, tenureMonths = 1, emisPaid = 0) => ({ startDate: new Date(date), tenureMonths, emisPaid, emiAmount: 7799, isArchived: false });
describe('credit card due month', () => {
  it('bills September purchases after the statement on October 29', () => {
    expect(firstCardEMIDueDate(purchase('2026-09-20'), card)).toBe('2026-10-29');
    expect(cardEMIInstalmentIndex(purchase('2026-09-20'), card, '2026-09')).toBeNull();
    expect(cardEMIInstalmentIndex(purchase('2026-09-20'), card, '2026-10')).toBe(0);
    expect(cardEMIDueDateIn(card, '2026-10')).toBe('2026-10-29');
    expect(cardEMIInstalmentIndex(purchase('2026-09-20'), card, '2026-11')).toBeNull();
  });
  it('places every instalment of a multi-month EMI by date, whatever was ticked', () => {
    expect(cardEMIInstalmentIndex(purchase('2026-04-04', 9), card, '2026-10')).toBe(6);
    expect(cardEMIInstalmentIndex(purchase('2026-04-04', 9), card, '2026-12')).toBe(8);
    expect(cardEMIInstalmentIndex(purchase('2026-04-04', 9), card, '2027-01')).toBeNull();
    expect(nextCardEMIDueDate(purchase('2026-06-09', 24, 4), card, '2026-10')).toBe('2026-10-29');
  });
  it('counts instalments billed once their due date has passed', () => {
    const flight = purchase('2026-04-04', 9);
    expect(billedInstalments(flight, card, '2026-04-28')).toBe(0);
    expect(billedInstalments(flight, card, '2026-04-29')).toBe(1);
    expect(billedInstalments(flight, card, '2026-11-06')).toBe(7);
    expect(billedInstalments(flight, card, '2027-06-01')).toBe(9);
    expect(nextCardEMIDueDate(purchase('2026-09-20', 1, 1), card, '2026-10')).toBeNull();
  });
  it('handles the statement/due cycle across December and clamps February', () => {
    const cycle = { statementDate: new Date('2026-12-25'), dueDate: new Date('2027-01-05') };
    expect(firstCardEMIDueDate(purchase('2026-12-26'), cycle)).toBe('2027-02-05');
    const monthEndCard = { statementDate: null, dueDate: new Date('2026-01-31') };
    expect(firstCardEMIDueDate(purchase('2028-02-20'), monthEndCard)).toBe('2028-02-29');
    expect(cardEMIDueDateIn(monthEndCard, '2028-03')).toBe('2028-03-31');
    expect(cardEMIInstalmentIndex(purchase('2028-02-20', 3), monthEndCard, '2028-03')).toBe(1);
  });
});
