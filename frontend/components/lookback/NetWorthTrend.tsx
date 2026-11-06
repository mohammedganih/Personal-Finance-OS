'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';

export interface TrendPoint { month: string; netWorth: number; approximate: boolean }

/**
 * Net worth at each month close: one ink line, a dot per month, a tooltip on
 * hover or tap. Approximate closes (worked out later) get a hollow dot.
 */
export function NetWorthTrend({ points, now }: { points: TrendPoint[]; now?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const series = now == null ? points : [...points, { month: 'now', netWorth: now, approximate: false }];
  if (series.length < 2) {
    return <p className="py-6 text-center text-sm text-ink-muted">The trend starts once two months are closed.</p>;
  }

  const W = 640, H = 200, padL = 8, padR = 8, padT = 16, padB = 28;
  const values = series.map((p) => p.netWorth);
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const min = lo - span * 0.15, max = hi + span * 0.15;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (series.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ');
  const label = (m: string) => (m === 'now' ? 'Now' : formatDate(`${m}-01`, 'MMM'));
  const step = Math.ceil(series.length / 8); // keep month labels from crowding on a phone
  const tip = active != null ? series[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full overflow-visible" role="img" aria-label="Net worth at each month close" onMouseLeave={() => setActive(null)}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} className="stroke-line" strokeWidth={1} />
        ))}
        <path d={path} fill="none" className="stroke-ink-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {active != null && <line x1={x(active)} x2={x(active)} y1={padT} y2={H - padB} className="stroke-line-strong" strokeWidth={1} />}
        {series.map((p, i) => (
          <g key={p.month}>
            <circle cx={x(i)} cy={y(p.netWorth)} r={4.5} strokeWidth={2}
              className={p.approximate ? 'fill-paper-card stroke-ink-primary' : 'fill-ink-primary stroke-paper-card'} />
            {(i % step === 0 || i === series.length - 1) && (
              <text x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className="fill-ink-muted text-[11px]">{label(p.month)}</text>
            )}
            {/* Wide invisible hit area per month. */}
            <rect x={x(i) - (W / series.length) / 2} y={0} width={W / series.length} height={H} fill="transparent"
              onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
          </g>
        ))}
      </svg>
      {tip && active != null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-paper-card px-2.5 py-1.5 text-xs shadow-soft"
          style={{ left: `${(x(active) / W) * 100}%`, transform: `translateX(${active === 0 ? '0' : active === series.length - 1 ? '-100%' : '-50%'})` }}>
          <p className="text-ink-muted">{tip.month === 'now' ? 'Today' : formatDate(`${tip.month}-01`, 'MMMM yyyy')}{tip.approximate ? ' · approximate' : ''}</p>
          <p className="font-semibold tabular-nums text-ink-primary">{formatCurrency(tip.netWorth)}</p>
        </div>
      )}
    </div>
  );
}
