'use client';

import { Wallet, Calendar, TrendingUp, HeartPulse, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoalProgress, useGoalProbability } from '@/hooks/useGoals';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';

function StatTile({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: typeof Wallet }) {
  return (
    <div className="bg-bg-elevated rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-text-muted" />}
        <p className="text-xs text-text-muted">{label}</p>
      </div>
      <p className={cn('text-base font-semibold font-mono', color ?? 'text-text-primary')}>{value}</p>
    </div>
  );
}

export function GoalOverviewTab({ goal }: { goal: Goal }) {
  const { data: progress, isLoading: progressLoading } = useGoalProgress(goal.id);
  const { data: probability, isLoading: probabilityLoading } = useGoalProbability(goal.id);

  if (progressLoading || probabilityLoading || !progress || !probability) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-32 shimmer" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Progress</p>
          <p className="text-sm font-bold text-accent-violet-light">{progress.currentPct.toFixed(1)}%</p>
        </div>
        <Progress value={progress.currentPct} className="h-3" />
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>{formatCurrency(goal.currentAmount, 'INR', true)} saved</span>
          <span>{formatCurrency(goal.targetAmount, 'INR', true)} target</span>
        </div>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Remaining" value={formatCurrency(progress.remainingAmount, 'INR', true)} icon={Wallet} />
        <StatTile label="Months Left" value={progress.monthsLeft.toFixed(1)} icon={Calendar} />
        <StatTile
          label="Required / mo"
          value={formatCurrency(progress.requiredMonthlySavings, 'INR', true)}
          color={progress.savingsGap > 0 ? 'text-danger' : 'text-success'}
          icon={TrendingUp}
        />
        <StatTile
          label="Current / mo"
          value={formatCurrency(progress.currentMonthlySavings, 'INR', true)}
          icon={Wallet}
        />
      </div>

      {/* Health / probability */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Goal Health</h3>
          </div>
          <Badge variant={probability.color as 'success' | 'warning' | 'danger'}>{probability.band} · {Math.round(probability.score)}</Badge>
        </div>
        <div className="space-y-2.5">
          {probability.factors.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-secondary">{f.label}</span>
                <span className="text-xs text-text-muted">{f.detail}</span>
              </div>
              <Progress value={f.score} className="h-1.5" indicatorClassName={f.score >= 70 ? 'bg-success' : f.score >= 40 ? 'bg-warning' : 'bg-danger'} />
            </div>
          ))}
        </div>
      </div>

      {/* Expected completion + shortfall */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-muted mb-1">Expected Completion</p>
          <p className="text-sm font-semibold text-text-primary">
            {progress.expectedFinishDate ? formatDate(progress.expectedFinishDate, 'MMM yyyy') : 'Never at current pace'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">Target: {formatDate(goal.targetDate, 'MMM yyyy')}</p>
        </div>
        {progress.savingsGap > 0 ? (
          <div className="glass-card rounded-2xl p-4 border border-danger/20 bg-danger/5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" />
              <p className="text-xs text-danger font-medium">Projected Shortfall</p>
            </div>
            <p className="text-sm font-semibold text-danger">{formatCurrency(progress.savingsGap, 'INR', true)}/mo</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4 border border-success/20 bg-success/5">
            <p className="text-xs text-success font-medium mb-1">On Track</p>
            <p className="text-sm font-semibold text-success">
              {formatCurrency(-progress.savingsGap, 'INR', true)}/mo ahead of plan
            </p>
          </div>
        )}
      </div>

      {(goal.description || goal.notes) && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          {goal.description && <p className="text-sm text-text-secondary">{goal.description}</p>}
          {goal.notes && <p className="text-xs text-text-muted">{goal.notes}</p>}
        </div>
      )}
    </div>
  );
}
