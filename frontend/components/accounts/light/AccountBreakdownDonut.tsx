'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useAccounts } from '@/hooks/useAccounts';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

const SIZE = 176;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const COLOR = { bank: '#3987e5', investments: '#199e70', loans: '#e66767', cash: '#9085e9' };

/**
 * Bank/Cash come from real Account balances split by type; Investments and
 * Loans (Outstanding) reuse the exact same totals the top stat cards and
 * Dashboard show (investmentValue, totalLiabilities) -- one real number
 * per bucket, not re-derived differently in two places.
 */
export function AccountBreakdownDonut() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const reduceMotion = useReducedMotion();

  if (accountsLoading || overviewLoading || !overview) return <div className="card-light rounded-2xl h-72 shimmer" />;

  const bank = (accounts ?? []).filter((a) => a.type === 'SAVINGS' || a.type === 'CHECKING' || a.type === 'OTHER').reduce((s, a) => s + a.balance, 0);
  const cash = (accounts ?? []).filter((a) => a.type === 'CASH').reduce((s, a) => s + a.balance, 0);

  const buckets = [
    { key: 'bank', label: 'Bank Accounts', value: Math.max(0, bank), color: COLOR.bank },
    { key: 'investments', label: 'Investments', value: Math.max(0, overview.investmentValue), color: COLOR.investments },
    { key: 'loans', label: 'Loans (Outstanding)', value: Math.max(0, overview.totalLiabilities), color: COLOR.loans },
    { key: 'cash', label: 'Cash', value: Math.max(0, cash), color: COLOR.cash },
  ].filter((b) => b.value > 0);

  const total = buckets.reduce((s, b) => s + b.value, 0);

  if (total === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-72 flex items-center justify-center text-sm text-ink-muted">
        No accounts tracked yet
      </div>
    );
  }

  let cumulative = 0;
  const segments = buckets.map((b) => {
    const pct = (b.value / total) * 100;
    const startFrac = cumulative / 100;
    cumulative += pct;
    return { ...b, percentage: pct, segLen: (pct / 100) * CIRCUMFERENCE, rotation: startFrac * 360 - 90 };
  });

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Account Breakdown</h3>

      <div className="flex items-center gap-6 flex-wrap">
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
        </div>

        <div className="flex-1 min-w-40 space-y-2.5">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{s.label}</p>
                <p className="text-[11px] text-ink-muted">{formatCurrency(s.value, 'INR', true)}</p>
              </span>
              <span className="text-xs text-ink-muted tabular-nums shrink-0">{s.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
