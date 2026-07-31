'use client';

import { motion } from 'framer-motion';
import { Ring } from '@/components/shared/Ring';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useGoalProgress } from '@/hooks/useGoals';
import { goalPredictionSentence } from '@/lib/goalPrediction';
import { formatCurrency } from '@/lib/format';
import { Goal } from '@/types';

interface GoalHeroProps {
  goal: Goal;
}

/**
 * Large ring + plain-language prediction sentence -- the accessible summary
 * of the whole hero, so a screen reader gets "on pace, three months late,
 * ₹3,000/mo gap" without needing the ring at all. A completed goal gets its
 * own celebratory state rather than a 100%-full version of the same card.
 */
export function GoalHero({ goal }: GoalHeroProps) {
  const { data: progress, isLoading } = useGoalProgress(goal.id);

  if (goal.isCompleted) {
    return (
      <div className="rounded-2xl p-6 bg-bg-surface border border-success/25 shadow-raised flex items-center gap-6 flex-wrap">
        <Ring pct={100} size={104} strokeWidth={10} color="#10B981" centerLabel={<span className="text-lg font-bold text-success">100%</span>} />
        <div>
          <p className="text-sm text-text-muted">Goal complete</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mt-1">🎉 Fully funded — {formatCurrency(goal.targetAmount, 'INR', true)} saved.</h2>
        </div>
      </div>
    );
  }

  if (isLoading || !progress) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-80" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  const ringColor = goal.color || '#7C3AED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised flex items-center gap-6 flex-wrap"
    >
      <Ring
        pct={progress.currentPct} size={104} strokeWidth={10} color={ringColor}
        centerLabel={<span className="text-lg font-bold text-text-primary">{progress.currentPct.toFixed(0)}%</span>}
      />
      <div className="flex-1 min-w-[220px]">
        <p className="text-lg font-medium text-text-primary max-w-xl text-balance">{goalPredictionSentence(goal, progress)}</p>
      </div>
    </motion.div>
  );
}
