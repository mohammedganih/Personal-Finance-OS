'use client';

import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useGoalProgress } from '@/hooks/useGoals';
import { GoalGrowthChart, ContributionTrendChart } from '@/components/goals/GoalCharts';
import { Goal } from '@/types';

const TREND_CONFIG = {
  increasing: { icon: TrendingUp, label: 'Increasing', color: 'text-success' },
  decreasing: { icon: TrendingDown, label: 'Decreasing', color: 'text-danger' },
  flat: { icon: Minus, label: 'Flat', color: 'text-text-secondary' },
  insufficient_data: { icon: HelpCircle, label: 'Not enough history', color: 'text-text-muted' },
};

export function GoalProgressTab({ goal }: { goal: Goal }) {
  const { data: progress, isLoading } = useGoalProgress(goal.id);

  if (isLoading || !progress) return <div className="glass-card rounded-2xl h-96 shimmer" />;

  const trend = TREND_CONFIG[progress.contributionTrend];
  const TrendIcon = trend.icon;

  return (
    <div className="space-y-4">
      <GoalGrowthChart goal={goal} progress={progress} />
      <ContributionTrendChart goalId={goal.id} />

      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Required Savings Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Daily', value: progress.requiredDailySavings },
            { label: 'Weekly', value: progress.requiredWeeklySavings },
            { label: 'Monthly', value: progress.requiredMonthlySavings },
            { label: 'Annual', value: progress.requiredAnnualSavings },
          ].map((s) => (
            <div key={s.label} className="bg-bg-elevated rounded-xl p-3 text-center">
              <p className="text-xs text-text-muted">{s.label}</p>
              <p className="text-sm font-semibold font-mono text-text-primary mt-0.5">{formatCurrency(s.value, 'INR', true)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendIcon className={`w-3.5 h-3.5 ${trend.color}`} />
            <p className="text-xs text-text-secondary">Contribution Trend</p>
          </div>
          <p className={`text-sm font-semibold ${trend.color}`}>{trend.label}</p>
          <p className="text-xs text-text-muted mt-0.5">Avg. {formatCurrency(progress.averageMonthlyContribution, 'INR', true)}/mo (last 6 months)</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-secondary mb-1">Inflation-Adjusted Target</p>
          <p className="text-sm font-semibold text-text-primary font-mono">{formatCurrency(progress.inflationAdjustedGoalValue, 'INR', true)}</p>
          <p className="text-xs text-text-muted mt-0.5">
            Real value of your projection: {formatCurrency(progress.realPurchasingPower, 'INR', true)}
          </p>
        </div>
      </div>
    </div>
  );
}
