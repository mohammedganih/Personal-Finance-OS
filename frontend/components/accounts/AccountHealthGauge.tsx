'use client';

import { useFinancialScore } from '@/hooks/useAnalytics';
import { HealthScoreBand } from '@/types';

const RING_SIZE = 64;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

const BAND_COLOR: Record<HealthScoreBand, string> = {
  excellent: '#0CA30C', good: '#0CA30C', fair: '#B45309', poor: '#C2410C', critical: '#D03B3B',
};

const BAND_LABEL: Record<HealthScoreBand, string> = {
  excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical',
};

/**
 * Compact top-row companion to the 4 stat cards, sized to match
 * StatCardLight rather than the full half-gauge shell (DebtHealthGaugeLight
 * /FinancialHealthGauge) -- same real composite score (useFinancialScore),
 * there's no separate "account health" metric in this app. Caption is the
 * weakest real factor's own detail text, not a canned "Keep it up!" line.
 */
export function AccountHealthGauge() {
  const { data, isLoading } = useFinancialScore();

  if (isLoading || !data) return <div className="card-light rounded-2xl h-28 shimmer" />;

  const score = Math.round(data.score);
  const color = BAND_COLOR[data.band];
  const weakest = [...data.components].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="card-light-hover rounded-2xl p-4 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="#F3F3F1" strokeWidth={RING_STROKE} />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
            strokeDashoffset={RING_CIRC - (score / 100) * RING_CIRC}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-ink-primary tabular-nums">{score}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">Account Health</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color }}>{BAND_LABEL[data.band]}</p>
        {weakest && <p className="text-[11px] text-ink-muted mt-1 leading-snug line-clamp-2">{weakest.detail}</p>}
      </div>
    </div>
  );
}
