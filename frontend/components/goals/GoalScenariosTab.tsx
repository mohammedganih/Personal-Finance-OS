'use client';

import { format, addMonths } from 'date-fns';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGoalScenarios, useUpdateGoal } from '@/hooks/useGoals';
import { Goal, GoalScenario } from '@/types';
import { cn } from '@/lib/utils';

function probabilityBadge(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

/**
 * Maps a named scenario back to the goal field it varies -- mirrors
 * runGoalScenarios' six fixed overrides exactly (backend/goalIntelligence
 * .service.ts). "Current Plan" is the plan already in effect, so there's
 * nothing to apply.
 */
function scenarioToGoalUpdate(scenario: GoalScenario, goal: Goal): Record<string, unknown> | null {
  const baseMonthly = goal.monthlyContribution ?? 0;
  switch (scenario.name) {
    case 'Increase Monthly Savings':
      return { monthlyContribution: Math.round(baseMonthly * 1.2) };
    case 'Delay Goal':
      return { targetDate: format(addMonths(new Date(goal.targetDate), 6), 'yyyy-MM-dd') };
    case 'Increase Investment Return':
      return { expectedReturnRate: (goal.expectedReturnRate ?? 0) + 2 };
    case 'Reduce Goal Cost':
      return { targetAmount: Math.round(goal.targetAmount * 0.9) };
    case 'Early Achievement':
      return { targetDate: format(addMonths(new Date(goal.targetDate), -6), 'yyyy-MM-dd') };
    default:
      return null;
  }
}

export function GoalScenariosTab({ goal }: { goal: Goal }) {
  const { data: scenarios, isLoading } = useGoalScenarios(goal.id);
  const { mutate: updateGoal, isPending } = useUpdateGoal();

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-56 shimmer" />)}</div>;
  if (!scenarios?.length) return null;

  // The highest-probability plan that's still realistic (>=60%), so the
  // recommendation isn't just whichever scenario happens to be cheapest.
  const realistic = scenarios.filter((s) => s.probability >= 60);
  const pool = realistic.length > 0 ? realistic : scenarios;
  const recommended = [...pool].sort((a, b) => b.probability - a.probability)[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {scenarios.map((s) => {
        const isRecommended = s.name === recommended.name;
        const update = scenarioToGoalUpdate(s, goal);
        return (
          <div
            key={s.name}
            className={cn(
              'glass-card rounded-2xl p-5 space-y-3',
              isRecommended && 'ring-2 ring-accent-violet/50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                  {isRecommended && <Badge className="bg-accent-violet/20 text-accent-violet-light text-[10px]">Recommended</Badge>}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{s.description}</p>
              </div>
              <Badge variant={probabilityBadge(s.probability)} className="shrink-0">{Math.round(s.probability)}%</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-bg-elevated rounded-lg p-2.5">
                <p className="text-text-muted">Completion Date</p>
                <p className="font-semibold text-text-primary mt-0.5">
                  {s.completionDate ? formatDate(s.completionDate, 'MMM yyyy') : 'Never'}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-2.5">
                <p className="text-text-muted">Monthly Needed</p>
                <p className="font-semibold text-text-primary mt-0.5 font-mono">{formatCurrency(s.monthlySavingNeeded, 'INR', true)}</p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-2.5">
                <p className="text-text-muted">Total Contributions</p>
                <p className="font-semibold text-text-primary mt-0.5 font-mono">{formatCurrency(s.totalContributions, 'INR', true)}</p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-2.5">
                <p className="text-text-muted">Investment Growth</p>
                <p className={cn('font-semibold mt-0.5 font-mono', s.investmentGrowth > 0 ? 'text-success' : 'text-text-primary')}>
                  {formatCurrency(s.investmentGrowth, 'INR', true)}
                </p>
              </div>
            </div>

            {s.inflationImpact > 0 && (
              <p className="text-xs text-warning">
                Inflation adds {formatCurrency(s.inflationImpact, 'INR', true)} to the real cost of this goal.
              </p>
            )}

            {update && (
              <Button
                size="sm" variant={isRecommended ? 'default' : 'outline'} className="w-full"
                disabled={isPending}
                onClick={() => updateGoal({ id: goal.id, data: update })}
              >
                Use this plan
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
