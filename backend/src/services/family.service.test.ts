import { describe, it, expect } from 'vitest';
import { simulatePayoff } from './family.service';

describe('simulatePayoff', () => {
  it('pays off a zero-interest loan in exactly balance/emi months', () => {
    const result = simulatePayoff([{ remainingBalance: 10000, emi: 1000, interestRate: 0 }], 0);
    expect(result.months).toBe(10);
    expect(result.totalInterest).toBe(0);
  });

  it('accrues interest when the rate is nonzero', () => {
    const result = simulatePayoff([{ remainingBalance: 10000, emi: 1000, interestRate: 12 }], 0);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it('total interest paying only minimums is order-independent', () => {
    const loans = [
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
    ];
    const forward = simulatePayoff(loans, 0);
    const reversed = simulatePayoff([...loans].reverse(), 0);
    expect(forward.totalInterest).toBeCloseTo(reversed.totalInterest, 4);
  });

  it('avalanche order (highest interest first) never costs more total interest than snowball order', () => {
    const avalancheOrder = [
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
    ];
    const snowballOrder = [
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
    ];
    const avalanche = simulatePayoff(avalancheOrder, 1000);
    const snowball = simulatePayoff(snowballOrder, 1000);
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });

  it('extra payment never increases months to pay off', () => {
    const loans = [{ remainingBalance: 20000, emi: 1000, interestRate: 24 }];
    const noExtra = simulatePayoff(loans, 0);
    const withExtra = simulatePayoff(loans, 2000);
    expect(withExtra.months).toBeLessThanOrEqual(noExtra.months);
  });
});
