'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { HOLDING_BUCKETS, BUCKET_COLORS, bucketForAssetType, HoldingBucket } from '@/lib/investmentBuckets';
import { formatCurrency } from '@/lib/format';

const SIZE = 176;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface AssetAllocationLightProps {
  onSelectBucket: (bucket: HoldingBucket | 'All') => void;
}

export function AssetAllocationLight({ onSelectBucket }: AssetAllocationLightProps) {
  const { data: summary, isLoading } = usePortfolioSummary();
  const reduceMotion = useReducedMotion();

  if (isLoading) return <div className="card-light rounded-2xl h-80 shimmer" />;

  const portfolio = summary?.portfolio ?? [];
  const total = portfolio.reduce((s, inv) => s + inv.currentValue, 0);

  if (portfolio.length === 0 || total <= 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-80 flex items-center justify-center text-sm text-ink-muted">
        No holdings yet
      </div>
    );
  }

  const byBucket = portfolio.reduce<Record<string, number>>((acc, inv) => {
    const bucket = bucketForAssetType(inv.assetType);
    acc[bucket] = (acc[bucket] ?? 0) + inv.currentValue;
    return acc;
  }, {});

  const entries = HOLDING_BUCKETS
    .map((bucket) => ({ bucket, value: byBucket[bucket] ?? 0, percentage: ((byBucket[bucket] ?? 0) / total) * 100 }))
    .filter((e) => e.value > 0);

  let cumulative = 0;
  const segments = entries.map((e) => {
    const startFrac = cumulative / 100;
    cumulative += e.percentage;
    return { ...e, segLen: (e.percentage / 100) * CIRCUMFERENCE, rotation: startFrac * 360 - 90 };
  });

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Asset Allocation</h3>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F3F3F1" strokeWidth={STROKE} />
            {segments.map((s, i) => (
              <motion.circle
                key={s.bucket}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={BUCKET_COLORS[s.bucket]}
                strokeWidth={STROKE}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                initial={reduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE - s.segLen }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                transform={`rotate(${s.rotation} ${SIZE / 2} ${SIZE / 2})`}
                className="cursor-pointer"
                onClick={() => onSelectBucket(s.bucket)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-lg font-bold text-ink-primary tabular-nums">{formatCurrency(total, 'INR', true)}</p>
            <p className="text-xs text-ink-muted">Total Value</p>
          </div>
        </div>

        <div className="w-full mt-5 space-y-2.5">
          {segments.map((s) => (
            <button
              key={s.bucket}
              onClick={() => onSelectBucket(s.bucket)}
              className="w-full flex items-center gap-2.5 text-left hover:bg-paper-subtle rounded-lg px-1.5 py-1 -mx-1.5 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BUCKET_COLORS[s.bucket] }} />
              <span className="text-xs text-ink-secondary flex-1 truncate">{s.bucket}</span>
              <span className="text-xs font-medium text-ink-primary tabular-nums">{s.percentage.toFixed(1)}%</span>
              <span className="text-xs text-ink-muted tabular-nums w-20 text-right">{formatCurrency(s.value, 'INR', true)}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onSelectBucket('All')}
        className="w-full flex items-center justify-between rounded-xl bg-paper-subtle hover:bg-line px-3.5 py-3 text-xs font-medium text-ink-primary transition-colors mt-4"
      >
        View Asset Allocation
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
