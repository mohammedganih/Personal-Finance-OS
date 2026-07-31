'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Wallet, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/StatCard';
import { PageShell } from '@/components/ui/PageShell';
import { useGoal, useDeleteGoal, useGoalProgress } from '@/hooks/useGoals';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalHero } from '@/components/goals/GoalHero';
import { GoalHealthCard } from '@/components/goals/GoalHealthCard';
import { GoalScenariosTab } from '@/components/goals/GoalScenariosTab';
import { GoalRecommendationsTab } from '@/components/goals/GoalRecommendationsTab';
import { GoalMilestonesTab } from '@/components/goals/GoalMilestonesTab';
import { GoalContributionsTab } from '@/components/goals/GoalContributionsTab';
import { GoalGrowthChart, ContributionTrendChart } from '@/components/goals/GoalCharts';
import { formatCurrency } from '@/lib/format';
import { GOAL_TYPE_LABELS, GOAL_TYPE_ICONS, GOAL_PRIORITY_LABELS } from '@/lib/constants';
import { GoalPriority } from '@/types';
import { useRouter } from 'next/navigation';

const PRIORITY_BADGE: Record<GoalPriority, 'danger' | 'warning' | 'default' | 'secondary'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'default', LOW: 'secondary',
};

export default function GoalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: goal, isLoading } = useGoal(params.id);
  const { data: progress } = useGoalProgress(params.id);
  const { mutate: deleteGoal } = useDeleteGoal();
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading || !goal) {
    return (
      <PageShell>
        <div className="h-8 w-48 rounded-lg shimmer" />
        <div className="h-32 rounded-2xl shimmer" />
        <div className="h-96 rounded-2xl shimmer" />
      </PageShell>
    );
  }

  const handleDelete = () => {
    deleteGoal(goal.id, { onSuccess: () => router.push('/goals') });
  };

  return (
    <PageShell>
      <Link href="/goals" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Goals
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: goal.color ? `${goal.color}20` : 'rgba(124,58,237,0.1)' }}
          >
            {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{goal.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-text-secondary">{GOAL_TYPE_LABELS[goal.goalType]}</span>
              <Badge variant={PRIORITY_BADGE[goal.priority]}>{GOAL_PRIORITY_LABELS[goal.priority]}</Badge>
              {goal.isCompleted && <Badge variant="success">Completed</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Tier 1: the ring + prediction sentence answer "am I on track" without a click. */}
      <GoalHero goal={goal} />

      {!goal.isCompleted && progress && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard compact title="Remaining" value={progress.remainingAmount} icon={Wallet} />
            <StatCard compact title="Months Left" value={progress.monthsLeft} isCurrency={false} displayValue={progress.monthsLeft.toFixed(1)} icon={Calendar} />
            <StatCard
              compact title="Required / mo" value={progress.requiredMonthlySavings} icon={TrendingUp}
              forceColor={progress.savingsGap > 0 ? 'danger' : 'success'}
            />
            <StatCard compact title="Current / mo" value={progress.currentMonthlySavings} icon={Wallet} />
          </div>

          {/* Tier 2: the milestone story. */}
          <GoalMilestonesTab goalId={goal.id} />

          {/* Tier 3: why the number is what it is, and the one action worth taking. */}
          <div className="grid lg:grid-cols-2 gap-4">
            <GoalHealthCard goalId={goal.id} />
            <GoalRecommendationsTab goalId={goal.id} />
          </div>

          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-3">Growth &amp; Trend</p>
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
                  <p className="text-xs text-text-secondary mb-1">Avg. Monthly Contribution</p>
                  <p className="text-sm font-semibold text-text-primary font-mono">{formatCurrency(progress.averageMonthlyContribution, 'INR', true)}</p>
                  <p className="text-xs text-text-muted mt-0.5">Last 6 months, trend: {progress.contributionTrend.replace('_', ' ')}</p>
                </div>
                <div className="glass-card rounded-2xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Inflation-Adjusted Target</p>
                  <p className="text-sm font-semibold text-text-primary font-mono">{formatCurrency(progress.inflationAdjustedGoalValue, 'INR', true)}</p>
                  <p className="text-xs text-text-muted mt-0.5">Real value of your projection: {formatCurrency(progress.realPurchasingPower, 'INR', true)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 4: what-if, restyled as a comparison a person can act on. */}
          <GoalScenariosTab goal={goal} />
        </>
      )}

      {(goal.description || goal.notes) && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          {goal.description && <p className="text-sm text-text-secondary">{goal.description}</p>}
          {goal.notes && <p className="text-xs text-text-muted">{goal.notes}</p>}
        </div>
      )}

      {/* Tier 5: contribution history -- the natural bottom of the scroll. */}
      <GoalContributionsTab goalId={goal.id} />

      {showEdit && <GoalForm goal={goal} onClose={() => setShowEdit(false)} />}
    </PageShell>
  );
}
