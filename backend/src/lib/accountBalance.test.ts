import { describe, it, expect } from 'vitest';
import { signedDelta } from './accountBalance';

describe('signedDelta', () => {
  it('is positive for INCOME', () => {
    expect(signedDelta('INCOME', 500)).toBe(500);
  });

  it('is negative for EXPENSE', () => {
    expect(signedDelta('EXPENSE', 500)).toBe(-500);
  });

  it('handles zero for both types', () => {
    expect(signedDelta('INCOME', 0)).toBeCloseTo(0);
    expect(signedDelta('EXPENSE', 0)).toBeCloseTo(0);
  });

  it('preserves magnitude', () => {
    expect(Math.abs(signedDelta('EXPENSE', 1234.56))).toBeCloseTo(1234.56);
  });
});
