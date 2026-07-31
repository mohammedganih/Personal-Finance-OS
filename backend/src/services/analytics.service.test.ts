import { describe, it, expect } from 'vitest';
import { computeSpendingRhythm, computeFinancialScore } from './analytics.service';

describe('computeSpendingRhythm (pure)', () => {
  it('returns all-zero days and no peak when there are no transactions', () => {
    const result = computeSpendingRhythm([], new Date(2026, 6, 31));
    expect(result.days).toHaveLength(7);
    expect(result.days.every((d) => d.avgAmount === 0 && d.occurrences === 0)).toBe(true);
    expect(result.weeksOfData).toBe(0);
    expect(result.hasEnoughData).toBe(false);
    expect(result.peakDay).toBeNull();
  });

  it('averages per weekday by how many times that weekday actually occurred, not total/7', () => {
    // Two Fridays (2026-07-03, 2026-07-10) and one Monday (2026-07-06).
    const transactions = [
      { date: new Date(2026, 6, 3), amount: 1000 }, // Friday
      { date: new Date(2026, 6, 10), amount: 2000 }, // Friday
      { date: new Date(2026, 6, 6), amount: 300 }, // Monday
    ];
    const result = computeSpendingRhythm(transactions, new Date(2026, 6, 31));
    const friday = result.days.find((d) => d.day === 'Fri')!;
    const monday = result.days.find((d) => d.day === 'Mon')!;
    expect(friday.avgAmount).toBe(1500); // (1000+2000)/2, not /7
    expect(friday.occurrences).toBe(2);
    expect(monday.avgAmount).toBe(300);
    expect(result.peakDay?.day).toBe('Fri');
  });

  it('flags insufficient data under 12 weeks of history', () => {
    const transactions = [{ date: new Date(2026, 6, 20), amount: 500 }];
    const result = computeSpendingRhythm(transactions, new Date(2026, 6, 31));
    expect(result.hasEnoughData).toBe(false);
  });

  it('flags enough data at 12+ weeks of history', () => {
    const transactions = [{ date: new Date(2026, 3, 1), amount: 500 }];
    const result = computeSpendingRhythm(transactions, new Date(2026, 6, 31));
    expect(result.weeksOfData).toBeGreaterThanOrEqual(12);
    expect(result.hasEnoughData).toBe(true);
  });
});

describe('computeFinancialScore (pure)', () => {
  it('weights debt, investment, and savings at 35/35/30 when investments exist', () => {
    const result = computeFinancialScore({ debtScore: 80, investmentScore: 60, savingsRatePct: 25 });
    expect(result.components).toHaveLength(3);
    const weights = result.components.map((c) => c.weight);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    // savings at the 25% ceiling scores 100: 80*0.35 + 60*0.35 + 100*0.30 = 79
    expect(result.score).toBe(79);
  });

  it('redistributes the investment weight across debt and savings when there are no holdings', () => {
    const result = computeFinancialScore({ debtScore: 80, investmentScore: null, savingsRatePct: 25 });
    expect(result.components).toHaveLength(2);
    const weights = result.components.map((c) => c.weight);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    // debt 0.35/0.65, savings 0.30/0.65 of (80, 100)
    expect(result.score).toBe(Math.round((80 * 0.35 + 100 * 0.3) / 0.65));
  });

  it('clamps a negative savings rate to a 0 savings score rather than going negative', () => {
    const result = computeFinancialScore({ debtScore: 50, investmentScore: 50, savingsRatePct: -20 });
    const savings = result.components.find((c) => c.label === 'Savings Rate')!;
    expect(savings.score).toBe(0);
  });

  it('bands the composite score consistently with the debt health bands', () => {
    const excellent = computeFinancialScore({ debtScore: 100, investmentScore: 100, savingsRatePct: 100 });
    expect(excellent.band).toBe('excellent');
    const critical = computeFinancialScore({ debtScore: 0, investmentScore: 0, savingsRatePct: 0 });
    expect(critical.band).toBe('critical');
  });
});
