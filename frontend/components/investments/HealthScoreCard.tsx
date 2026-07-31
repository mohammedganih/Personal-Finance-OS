'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Gauge } from 'lucide-react';
import { useInvestmentHealth } from '@/hooks/useInvestmentIntelligence';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const LABEL_COLOR: Record<string, string> = {
  Excellent: 'text-success',
  Good: 'text-success',
  Fair: 'text-warning',
  'Needs attention': 'text-danger',
};

/**
 * Score and risk position both come from the real /investments/health
 * aggregation (concentration + XIRR for the score, asset-class weighting for
 * risk) -- see investmentIntelligence.service.ts. Nothing here is a
 * placeholder number.
 */
export function HealthScoreCard() {
  const { data, isLoading } = useInvestmentHealth();
  const reduceMotion = useReducedMotion();

  // Mounts the bar at 0 and steps it to the real score a frame later so the
  // existing Progress component's CSS transition reads as a fill-in, not a
  // value that was simply always there.
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    if (!data) return;
    if (reduceMotion) { setDisplayScore(data.score); return; }
    const raf = requestAnimationFrame(() => setDisplayScore(data.score));
    return () => cancelAnimationFrame(raf);
  }, [data, reduceMotion]);

  if (isLoading) return <div className="glass-card rounded-2xl h-72 shimmer" />;
  if (!data) return null;

  const scoreColor = LABEL_COLOR[data.label] ?? 'text-text-primary';

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Investment Health</h3>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className={cn('text-3xl font-bold', scoreColor)}>{data.score}</span>
          <span className="text-xs text-text-muted">/ 100</span>
        </div>
        <Progress value={displayScore} className="h-1.5" />
        <p className={cn('text-xs mt-2', scoreColor)}>
          {data.label} — {data.caption}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-secondary mb-2">Risk profile</p>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-info/40 via-warning/40 to-danger/40">
          <motion.div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-text-primary ring-2 ring-bg-surface shadow-sm"
            style={{ transform: 'translate(-50%, -50%)' }}
            initial={reduceMotion ? false : { left: '50%' }}
            animate={{ left: `${data.risk.position}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
          <span>Conservative</span>
          <span>Balanced</span>
          <span>Aggressive</span>
        </div>
        <p className="text-xs text-text-secondary mt-2">{data.risk.caption}</p>
      </div>
    </div>
  );
}
