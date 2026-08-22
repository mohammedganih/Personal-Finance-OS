'use client';

import { useGoals } from '@/hooks/useGoals';
import { formatCurrency } from '@/lib/format';

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Aggregated client-side from the real goal list (targetAmount/currentAmount
 * already on Goal) -- no separate "goals overview" endpoint needed for a
 * plain sum-of-sums. Same restrained black-arc convention as
 * FinancialHealthGauge/DebtHealthGaugeLight: color is reserved for context,
 * not a general wash across the ring itself.
 */
export function OverallGoalProgressLight() {
  const { data: goals, isLoading } = useGoals();

  if (isLoading || !goals) return <div className="card-light rounded-2xl h-72 shimmer" />;

  const active = goals.filter((g) => !g.isCompleted);
  const totalRequired = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const pct = totalRequired > 0 ? Math.min(100, (totalSaved / totalRequired) * 100) : 0;
  const offset = CIRC - (pct / 100) * CIRC;

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col items-center text-center">
      <h3 className="text-sm font-semibold text-ink-primary self-start mb-2">Overall Goal Progress</h3>

      <div className="relative my-2" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F3F3F1" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="#0B0B0B"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink-primary tabular-nums">{pct.toFixed(1)}%</span>
          <span className="text-xs text-ink-muted mt-0.5">of total goal</span>
        </div>
      </div>

      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink-primary">{formatCurrency(totalSaved, 'INR', true)}</span> of {formatCurrency(totalRequired, 'INR', true)}
      </p>
    </div>
  );
}
