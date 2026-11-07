import { describe, it, expect } from 'vitest';
import { computeFinancialScore } from './analytics.service';

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
