'use client';

import { Target, Briefcase, PiggyBank, CalendarCheck } from 'lucide-react';
import { StatCardLight } from '@/components/dashboard/light/StatCardLight';
import { useGoals, useGoalInsights } from '@/hooks/useGoals';
import { formatCurrency } from '@/lib/format';

/**
 * All four figures are aggregated client-side from the real goal list --
 * no bulk "goals overview" endpoint exists, and every field summed here
 * (targetAmount, currentAmount, monthlyContribution) already lives on Goal
 * itself. The on-track/at-risk split reuses useGoalInsights() (one call,
 * already built for the AI Insights panel) rather than fetching each
 * goal's /progress individually just to count two buckets.
 *
 * No GoalSnapshot model exists (unlike NetWorth/Debt), so there's no real
 * "vs last month" trend to show on Total Saved -- shows share of total
 * required instead rather than fabricating a delta.
 */
export function StatsRowGoals() {
  const { data: goals, isLoading } = useGoals();
  const { data: insights } = useGoalInsights();

  if (isLoading || !goals) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-28 shimmer" />)}
      </div>
    );
  }

  const active = goals.filter((g) => !g.isCompleted);
  const totalRequired = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const monthlySavings = active.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0);
  const pctSaved = totalRequired > 0 ? (totalSaved / totalRequired) * 100 : 0;

  const atRiskIds = new Set((insights ?? []).filter((i) => i.severity === 'warning').map((i) => i.goalId));
  const atRiskCount = active.filter((g) => atRiskIds.has(g.id)).length;
  const onTrackCount = active.length - atRiskCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card-light-hover rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5 text-mono" />
          </div>
          <p className="text-xs text-ink-muted truncate">Total Goals</p>
        </div>
        <p className="text-2xl font-bold text-ink-primary tabular-nums">{active.length}</p>
        <p className="text-xs text-ink-muted mt-1">Active goals</p>
        <p className="text-xs mt-1.5">
          <span className="font-medium text-updown-up">{onTrackCount} On Track</span>
          {atRiskCount > 0 && <span className="font-medium ml-2" style={{ color: '#B45309' }}>{atRiskCount} At Risk</span>}
        </p>
      </div>

      <StatCardLight
        label="Total Required"
        value={formatCurrency(totalRequired, 'INR', true)}
        icon={Briefcase}
        emptyHint="Across all goals"
      />
      <StatCardLight
        label="Total Saved"
        value={formatCurrency(totalSaved, 'INR', true)}
        icon={PiggyBank}
        emptyHint={`${pctSaved.toFixed(1)}% of total required`}
      />
      <StatCardLight
        label="Monthly Savings"
        value={formatCurrency(monthlySavings, 'INR', true)}
        icon={CalendarCheck}
        emptyHint={`Across ${active.length} active goal${active.length === 1 ? '' : 's'}`}
      />
    </div>
  );
}
