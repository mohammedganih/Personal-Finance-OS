'use client';

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoals } from '@/hooks/useGoals';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency } from '@/lib/format';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalPriority } from '@/types';

const PRIORITY_ORDER: Record<GoalPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: goals, isLoading } = useGoals();

  const active = (goals ?? [])
    .filter((g) => !g.isCompleted)
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });
  const completed = (goals ?? []).filter((g) => g.isCompleted);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Goals</h2>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} active · {completed.length} completed</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-52 shimmer" />)}</div>
      ) : active.length === 0 && completed.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set a savings goal and track your progress" action={{ label: 'Create Goal', onClick: () => setShowForm(true) }} />
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

      {showForm && <GoalForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
