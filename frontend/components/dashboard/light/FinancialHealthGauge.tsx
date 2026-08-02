'use client';

import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { useFinancialScore } from '@/hooks/useAnalytics';
import { HealthScoreBand } from '@/types';

// Band color only tints the small label -- the arc itself stays neutral
// black/gray, matching this dashboard's restrained palette where color is
// reserved for explicit gain/loss direction, not a general "good/bad" wash.
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
 * Wraps the real Debt Health + Investment Health + savings-rate composite
 * already built for Analytics (useFinancialScore) in a radial gauge. The
 * reference design's "better than X% of users" line has no real backing
 * data in a single-household app -- replaced with the actual lowest-scoring
 * component's own detail text, and a link to the full breakdown that
 * already renders on Analytics.
 */
export function FinancialHealthGauge() {
  const { data, isLoading } = useFinancialScore();

  if (isLoading || !data) {
    return <div className="card-light rounded-2xl h-64 shimmer" />;
  }

  const labelColor = BAND_TEXT_COLOR[data.band];
  const weakest = [...data.components].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-ink-primary">Financial Health Score</h3>

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
          data={[{ value: data.score, fill: '#0B0B0B' }]}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#F3F3F1' }} dataKey="value" cornerRadius={8} isAnimationActive={false} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
          <span className="text-3xl font-bold text-ink-primary tabular-nums">{data.score}</span>
          <span className="text-xs font-medium flex items-center gap-1 mt-0.5" style={{ color: labelColor }}>
            <Activity className="w-3 h-3" />
            {BAND_LABEL[data.band]}
          </span>
        </div>
      </div>

      {weakest && (
        <p className="text-xs text-ink-muted leading-relaxed mb-3">{weakest.detail}</p>
      )}
      <Link
        href="/analytics"
        className="w-full flex items-center justify-between rounded-xl bg-paper-subtle hover:bg-line px-3.5 py-3 text-xs font-medium text-ink-primary transition-colors"
      >
        View Full Report
        <span className="w-5 h-5 rounded-full bg-paper-card border border-line flex items-center justify-center">
          <ArrowRight className="w-3 h-3" />
        </span>
      </Link>
    </div>
  );
}
