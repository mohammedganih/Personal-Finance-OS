'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { PieChart } from 'lucide-react';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { formatCurrency } from '@/lib/format';
import { ASSET_TYPE_LABELS, CHART_COLORS } from '@/lib/constants';

const SIZE = 160;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface AllocationDonutProps {
  onSelectType?: (type: string) => void;
}

/**
 * Each segment is its own circle, rotated to its cumulative starting angle
 * and revealed via strokeDashoffset -- the standard multi-segment donut
 * sweep-in trick, since a single CSS conic-gradient can't be staggered
 * per-segment the way Framer Motion can animate an SVG stroke.
 */
export function AllocationDonut({ onSelectType }: AllocationDonutProps) {
  const { data, isLoading } = usePortfolioSummary();
  const reduceMotion = useReducedMotion();

  if (isLoading) return <ChartSkeleton height="h-72" />;

  const allocation = data?.allocationByType ?? {};
  const total = data?.totalCurrent ?? 0;
  const entries = Object.entries(allocation)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([type, value], i) => ({
      type,
      label: ASSET_TYPE_LABELS[type] ?? type,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  if (entries.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-5 flex items-center justify-center h-72 text-sm text-text-muted">
        No holdings yet
      </div>
    );
  }

  let cumulative = 0;
  const segments = entries.map((e) => {
    const startFrac = cumulative / 100;
    cumulative += e.pct;
    const segLen = (e.pct / 100) * CIRCUMFERENCE;
    const rotation = startFrac * 360 - 90;
    return { ...e, segLen, rotation };
  });

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Asset Allocation</h3>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-0">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="currentColor" className="text-bg-elevated" strokeWidth={STROKE} />
            {segments.map((s, i) => (
              <motion.circle
                key={s.type}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-base font-bold text-text-primary font-mono">{formatCurrency(total, 'INR', true)}</span>
            <span className="text-xs text-text-muted">current</span>
          </div>
        </div>

        <div className="flex-1 min-w-40 space-y-1.5">
          {segments.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => onSelectType?.(s.type)}
              className="flex items-center gap-2 w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-bg-elevated/60 transition-colors"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-text-secondary flex-1 truncate">{s.label}</span>
              <span className="text-xs text-text-muted">{s.pct.toFixed(0)}%</span>
              <span className="text-xs font-medium text-text-primary font-mono w-16 text-right shrink-0">
                {formatCurrency(s.value, 'INR', true)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Same data, in a form a screen reader can traverse without relying on ring geometry. */}
      <table className="sr-only">
        <caption>Asset allocation breakdown</caption>
        <thead><tr><th>Asset type</th><th>Value</th><th>Percentage</th></tr></thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.type}><td>{s.label}</td><td>{formatCurrency(s.value, 'INR')}</td><td>{s.pct.toFixed(1)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
