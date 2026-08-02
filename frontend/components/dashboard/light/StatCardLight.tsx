'use client';

import { LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const RING_SIZE = 36;
const RING_STROKE = 4;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

interface StatCardLightProps {
  label: string;
  value: string;
  icon: LucideIcon;
  subtitle?: string; // always-shown info line, independent of the delta/emptyHint line below it
  deltaPct?: number | null;
  deltaLabel?: string;
  deltaGoodWhenUp?: boolean;
  sparkline?: number[];
  sparklineColor?: string;
  ring?: number; // 0-100 -- renders in place of a sparkline
  ringColor?: string;
  emptyHint?: string;
}

export function StatCardLight({
  label, value, icon: Icon, subtitle, deltaPct, deltaLabel = 'vs last month', deltaGoodWhenUp = true,
  sparkline, sparklineColor = '#9CA3AF', ring, ringColor = '#10B981', emptyHint,
}: StatCardLightProps) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null;
  const isGood = hasDelta ? (deltaGoodWhenUp ? deltaPct! >= 0 : deltaPct! < 0) : true;
  const sparkData = sparkline?.map((v) => ({ v }));

  return (
    <div className="card-light-hover rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-mono" />
            </div>
            <p className="text-xs text-ink-muted truncate">{label}</p>
          </div>
          <p className="text-2xl font-bold text-ink-primary tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-ink-muted mt-1">{subtitle}</p>}

          {hasDelta ? (
            <p className="text-xs mt-1.5">
              <span className={cn('font-medium', isGood ? 'text-updown-up' : 'text-updown-down')}>
                {deltaPct! >= 0 ? '↑' : '↓'} {Math.abs(deltaPct!).toFixed(1)}%
              </span>{' '}
              <span className="text-ink-muted">{deltaLabel}</span>
            </p>
          ) : emptyHint ? (
            <p className="text-xs text-ink-muted mt-1.5">{emptyHint}</p>
          ) : null}
        </div>

        {ring !== undefined && (
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="shrink-0">
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="#F3F3F1" strokeWidth={RING_STROKE} />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
              strokeDashoffset={RING_CIRC - (Math.min(100, Math.max(0, ring)) / 100) * RING_CIRC}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
        )}
      </div>

      {sparkData && sparkData.length > 1 && (
        <div className="h-8 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
              <Line type="monotone" dataKey="v" stroke={sparklineColor} strokeWidth={1.75} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
