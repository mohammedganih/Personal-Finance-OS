import { describe, it, expect } from 'vitest';
import { calcEMIOutstanding } from './card-emi.service';

describe('calcEMIOutstanding', () => {
  it('is a flat multiplication for no-cost EMIs', () => {
    const outstanding = calcEMIOutstanding({
      isNoCost: true,
      interestRate: null,
      totalAmount: 12000,
      emiAmount: 1100,
      tenureMonths: 12,
      emisPaid: 6,
    });
    expect(outstanding).toBeCloseTo(1100 * 6, 2);
  });

  it('uses reverse amortization for interest-bearing EMIs', () => {
    const outstanding = calcEMIOutstanding({
      isNoCost: false,
      interestRate: 12,
      totalAmount: 12000,
      emiAmount: 1100,
      tenureMonths: 12,
      emisPaid: 6,
    });
    // Independently computed: P(1+r)^n - EMI*[(1+r)^n - 1]/r, r = 1%/month, n = 6
    expect(outstanding).toBeCloseTo(5971.03, 1);
  });

  it('is 0 once every installment is paid', () => {
    const outstanding = calcEMIOutstanding({
      isNoCost: false,
      interestRate: 12,
      totalAmount: 12000,
      emiAmount: 1100,
      tenureMonths: 12,
      emisPaid: 12,
    });
    expect(outstanding).toBe(0);
  });

  it('falls back to flat multiplication when interestRate is missing', () => {
    const outstanding = calcEMIOutstanding({
      isNoCost: false,
      interestRate: null,
      totalAmount: 12000,
      emiAmount: 1100,
      tenureMonths: 12,
      emisPaid: 3,
    });
    expect(outstanding).toBeCloseTo(1100 * 9, 2);
  });

  it('never goes negative', () => {
    const outstanding = calcEMIOutstanding({
      isNoCost: false,
      interestRate: 12,
      totalAmount: 12000,
      emiAmount: 1100,
      tenureMonths: 12,
      emisPaid: 20, // more than tenure -- shouldn't happen, but must not blow up
    });
    expect(outstanding).toBe(0);
  });
});
