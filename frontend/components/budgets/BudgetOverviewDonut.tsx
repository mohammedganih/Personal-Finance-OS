'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useBudgets } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { BUDGET_STATUS_LABEL, BUDGET_STATUS_COLOR } from '@/lib/budgetStatusMeta';
import { BudgetStatus } from '@/types';

const SIZE = 176;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const STATUS_ORDER: BudgetStatus[] = ['under', 'near', 'over'];

/**
 * Segments are the real category-status distribution (same field the
 * table's tabs use); the center label is the overall spend-weighted
 * utilization (computeBudgetPacing's combinedBurnPct) -- two different
 * real numbers shown together, not one metric split two ways.
 */
export function BudgetOverviewDonut() {
  const { data: budgets, isLoading } = useBudgets();
  const reduceMotion = useReducedMotion();

  if (isLoading || !budgets) return <div className="card-light rounded-2xl h-80 shimmer" />;

  if (budgets.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-80 flex items-center justify-center text-sm text-ink-muted">
        No category budgets yet
      </div>
    );
  }

  const pacing = computeBudgetPacing(budgets);
  const counts = STATUS_ORDER.map((status) => ({
    status, count: budgets.filter((b) => b.status === status).length, color: BUDGET_STATUS_COLOR[status],
  })).filter((s) => s.count > 0);

  let cumulative = 0;
  const segments = counts.map((s) => {
    const pct = (s.count / budgets.length) * 100;
    const startFrac = cumulative / 100;
    cumulative += pct;
    return { ...s, segLen: (pct / 100) * CIRCUMFERENCE, rotation: startFrac * 360 - 90 };
  });

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Budget Overview</h3>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F3F3F1" strokeWidth={STROKE} />
            {segments.map((s, i) => (
              <motion.circle
                key={s.status}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                initial={reduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE - s.segLen }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                transform={`rotate(${s.rotation} ${SIZE / 2} ${SIZE / 2})`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-ink-primary tabular-nums">{pacing.combinedBurnPct.toFixed(1)}%</p>
            <p className="text-xs text-ink-muted">of budget used</p>
          </div>
        </div>

        <div className="flex-1 min-w-40 space-y-2.5">
          {counts.map((s) => (
            <div key={s.status} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-primary">{BUDGET_STATUS_LABEL[s.status]}</p>
                <p className="text-[11px] text-ink-muted">{s.count} categor{s.count === 1 ? 'y' : 'ies'}</p>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
