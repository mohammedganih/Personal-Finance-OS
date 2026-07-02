import { describe, it, expect } from 'vitest';
import { calculateEMISplit } from './loan.service';

describe('calculateEMISplit', () => {
  it('splits a standard EMI into interest and principal', () => {
    const result = calculateEMISplit(100000, 5000, 12); // 12% annual = 1% monthly
    expect(result.interestPortion).toBeCloseTo(1000, 2);
    expect(result.principalPortion).toBeCloseTo(4000, 2);
    expect(result.actualPayment).toBeCloseTo(5000, 2);
    expect(result.newBalance).toBeCloseTo(96000, 2);
    expect(result.isPaidOff).toBe(false);
  });

  it('never lets the final payment exceed what is actually owed', () => {
    const result = calculateEMISplit(3000, 5000, 12);
    expect(result.actualPayment).toBeCloseTo(3030, 2); // remaining + interest, not the full EMI
    expect(result.newBalance).toBe(0);
    expect(result.isPaidOff).toBe(true);
  });

  it('treats a balance under ₹1 as paid off', () => {
    const result = calculateEMISplit(0.5, 5000, 12);
    expect(result.isPaidOff).toBe(true);
  });

  it('handles a zero-interest loan as a flat principal reduction', () => {
    const result = calculateEMISplit(5000, 1000, 0);
    expect(result.interestPortion).toBe(0);
    expect(result.principalPortion).toBe(1000);
    expect(result.newBalance).toBe(4000);
  });

  it('interest and principal always sum to the actual payment (for a non-final installment)', () => {
    const result = calculateEMISplit(50000, 2000, 9);
    expect(result.interestPortion + result.principalPortion).toBeCloseTo(result.actualPayment, 6);
  });
});
