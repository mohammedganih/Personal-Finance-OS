'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronRight } from 'lucide-react';
import { useLoans } from '@/hooks/useLoans';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCardEMIs } from '@/hooks/useCardEMIs';
import { useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { LOAN_TYPE_COLORS, CREDIT_CARD_BUCKET_COLOR } from '@/lib/loanTypeMeta';
import { LOAN_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { LoanType } from '@/types';
import { PrepaymentPlanDialog } from './PrepaymentPlanDialog';

const SIZE = 176;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Bucket = { key: string; label: string; color: string; value: number };

export function LoanOverviewDonut() {
  const { data: loans, isLoading: loansLoading } = useLoans();
  const { data: cards, isLoading: cardsLoading } = useCreditCards();
  const { data: cardEmis } = useCardEMIs(false);
  const { data: strategy } = useDebtStrategy(5000);
  const reduceMotion = useReducedMotion();
  const [showPlan, setShowPlan] = useState(false);

  if (loansLoading || cardsLoading) return <div className="card-light rounded-2xl h-80 shimmer" />;

  const activeLoans = (loans ?? []).filter((l) => l.isActive);
  const activeCards = (cards ?? []).filter((c) => c.isActive);
  const cardEmiOutstanding = (cardEmis ?? []).reduce((s, e) => s + e.outstanding, 0);
  const cardBucketValue = activeCards.reduce((s, c) => s + c.outstanding, 0) + cardEmiOutstanding;

  const total = activeLoans.reduce((s, l) => s + l.remainingBalance, 0) + cardBucketValue;

  if (activeLoans.length === 0 && activeCards.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-80 flex items-center justify-center text-sm text-ink-muted">
        No loans tracked yet
      </div>
    );
  }

  const byType = activeLoans.reduce<Record<string, number>>((acc, l) => {
    acc[l.loanType] = (acc[l.loanType] ?? 0) + l.remainingBalance;
    return acc;
  }, {});

  const buckets: Bucket[] = (Object.keys(byType) as LoanType[])
    .map((t) => ({ key: t, label: LOAN_TYPE_LABELS[t] ?? t, color: LOAN_TYPE_COLORS[t], value: byType[t] }))
    .sort((a, b) => b.value - a.value);

  if (cardBucketValue > 0) {
    buckets.push({ key: 'CREDIT_CARD', label: 'Credit Card Outstanding', color: CREDIT_CARD_BUCKET_COLOR, value: cardBucketValue });
  }

  let cumulative = 0;
  const segments = buckets.map((b) => {
    const pct = total > 0 ? (b.value / total) * 100 : 0;
    const startFrac = cumulative / 100;
    cumulative += pct;
    return { ...b, percentage: pct, segLen: (pct / 100) * CIRCUMFERENCE, rotation: startFrac * 360 - 90 };
  });

  // Real derived series: the growing gap between the contracted (no extra
  // payment) and accelerated (best strategy + extra payment) balance
  // schedules -- both are genuine month-by-month simulations already
  // returned by getDebtStrategy, not a stored "interest saved over time"
  // series (which doesn't exist), but a legitimate proxy for it.
  const gapSeries = strategy && strategy.contractedSchedule.length > 1
    ? strategy.contractedSchedule.map((v, i) => ({ v: v - (strategy.acceleratedSchedule[i] ?? v) }))
    : null;

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary">Loan Overview</h3>
      <p className="text-xs text-ink-muted mt-0.5 mb-4">Breakdown of your total loan outstanding</p>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex items-center gap-6 flex-1 flex-wrap">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F3F3F1" strokeWidth={STROKE} />
              {segments.map((s, i) => (
                <motion.circle
                  key={s.key}
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
              <p className="text-xs text-ink-muted">Total Outstanding</p>
              <p className="text-lg font-bold text-ink-primary tabular-nums">{formatCurrency(total, 'INR', true)}</p>
            </div>
          </div>

          <div className="flex-1 min-w-48 space-y-2.5">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-ink-secondary flex-1 truncate">{s.label}</span>
                <span className="text-xs font-medium text-ink-primary tabular-nums w-20 text-right">{formatCurrency(s.value, 'INR', true)}</span>
                <span className="text-xs text-ink-muted tabular-nums w-12 text-right">{s.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {strategy && strategy.totalInterestSaved > 0 && (
          <div className="lg:w-64 shrink-0 rounded-xl bg-paper-subtle p-4 flex flex-col">
            <p className="text-sm font-semibold text-ink-primary leading-snug">
              You&apos;ll save {formatCurrency(strategy.totalInterestSaved, 'INR', true)} in interest
            </p>
            <p className="text-xs text-ink-muted mt-1">
              By paying an additional {formatCurrency(strategy.extraPayment, 'INR', true)} every month across your loans.
            </p>

            {gapSeries && (
              <div className="h-10 mt-3 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gapSeries} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                    <Line type="monotone" dataKey="v" stroke="#10B981" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <button
              onClick={() => setShowPlan(true)}
              className="w-full flex items-center justify-between rounded-xl bg-paper-card border border-line px-3.5 py-2.5 text-xs font-medium text-ink-primary hover:bg-line transition-colors mt-3"
            >
              View Prepayment Plan
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showPlan && <PrepaymentPlanDialog onClose={() => setShowPlan(false)} />}
    </div>
  );
}
