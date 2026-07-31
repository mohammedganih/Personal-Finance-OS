'use client';

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { FinancialFreedomPlan } from '@/components/dashboard/FinancialFreedomPlan';
import { useGoals } from '@/hooks/useGoals';
import { formatCurrency } from '@/lib/format';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalPriority, GoalType } from '@/types';

const PRIORITY_ORDER: Record<GoalPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// A few common starting points instead of a blank form -- all real,
// already-supported goal types, not an illustrative type invented for the mock.
const STARTER_TEMPLATES: { goalType: GoalType; name: string }[] = [
  { goalType: 'EMERGENCY_FUND', name: 'Emergency Fund' },
  { goalType: 'TRAVEL', name: 'Vacation' },
  { goalType: 'CAR_PURCHASE', name: 'Car Purchase' },
];

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const [template, setTemplate] = useState<{ goalType: GoalType; name: string } | undefined>(undefined);
  const { data: goals, isLoading } = useGoals();

  const openForm = (t?: { goalType: GoalType; name: string }) => { setTemplate(t); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setTemplate(undefined); };

  const active = (goals ?? [])
    .filter((g) => !g.isCompleted)
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });
  const completed = (goals ?? []).filter((g) => g.isCompleted);

  return (
    <PageShell>
      <PageHeader
        title="Goals"
        subtitle={`${active.length} active · ${completed.length} completed`}
        action={
          <Button onClick={() => openForm()} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Goal
          </Button>
        }
      />

      <FinancialFreedomPlan />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-52 shimmer" />)}</div>
      ) : active.length === 0 && completed.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-5">
          <Target className="w-10 h-10 text-text-muted mx-auto" />
          <div>
            <p className="text-base font-semibold text-text-primary">What are you saving toward?</p>
            <p className="text-sm text-text-secondary mt-1">Pick a starting point, or create a custom goal from scratch.</p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.goalType}
                onClick={() => openForm(t)}
                className="flex flex-col items-center gap-1.5 px-5 py-4 rounded-xl bg-bg-elevated border border-border hover:border-accent-violet/40 hover:bg-accent-violet/5 transition-colors"
              >
                <span className="text-2xl">{GOAL_TYPE_ICONS[t.goalType]}</span>
                <span className="text-xs font-medium text-text-secondary">{t.name}</span>
              </button>
            ))}
          </div>
          <button onClick={() => openForm()} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            or create a custom goal →
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Completed</h3>
              <div className="grid grid-cols-2 gap-3">
                {completed.map((goal) => (
                  <div key={goal.id} className="glass-card rounded-2xl p-4 opacity-60 flex items-center gap-3">
                    <span className="text-xl">{goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '✅'}</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{goal.name}</p>
                      <p className="text-xs text-success">{formatCurrency(goal.targetAmount, 'INR', true)} achieved</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && <GoalForm onClose={closeForm} template={template} />}
    </PageShell>
  );
}
