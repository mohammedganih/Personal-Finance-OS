'use client';

import { Activity } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { useHealthScore } from '@/hooks/useDebtIntelligence';
import { HealthScoreBand } from '@/types';

// Same neutral-arc, colored-label convention as the Dashboard's
// FinancialHealthGauge -- color is reserved for the label, not a general
// "good/bad" wash across the whole gauge.
const BAND_TEXT_COLOR: Record<HealthScoreBand, string> = {
  excellent: '#0CA30C',
  good: '#0CA30C',
  fair: '#B45309',
  poor: '#C2410C',
  critical: '#D03B3B',
};

const BAND_LABEL: Record<HealthScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

/**
 * Mechanically identical gauge shell to FinancialHealthGauge.tsx, bound to
 * useHealthScore() -- literally the same debt health score already used as
 * the Dashboard's blended "Debt Health" factor (analytics.service.ts), just
 * given its own dedicated card here. Caption is the weakest real factor's
 * detail text, not a canned "well managed" phrase, so it stays honest at
 * every band rather than only at the one the reference happened to show.
 */
export function DebtHealthGaugeLight() {
  const { data, isLoading } = useHealthScore();

  if (isLoading || !data) {
    return <div className="card-light rounded-2xl h-64 shimmer" />;
  }

  const score = Math.round(data.score);
  const labelColor = BAND_TEXT_COLOR[data.band];
  const weakest = [...data.factors].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-ink-primary">Debt Health Score</h3>

      <div className="relative mx-auto my-2" style={{ width: 240, height: 130 }}>
        <RadialBarChart
          width={240}
          height={130}
          cx={120}
          cy={120}
          innerRadius={85}
          outerRadius={105}
          startAngle={180}
          endAngle={0}
          data={[{ value: score, fill: '#0B0B0B' }]}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#F3F3F1' }} dataKey="value" cornerRadius={8} isAnimationActive={false} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
          <span className="text-3xl font-bold text-ink-primary tabular-nums">{score}</span>
          <span className="text-xs font-medium flex items-center gap-1 mt-0.5" style={{ color: labelColor }}>
            <Activity className="w-3 h-3" />
            {BAND_LABEL[data.band]}
          </span>
        </div>
      </div>

      {weakest && (
        <p className="text-xs text-ink-muted leading-relaxed text-center">{weakest.detail}</p>
      )}
    </div>
  );
}
