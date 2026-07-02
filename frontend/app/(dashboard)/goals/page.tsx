'use client';

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useGoals, useDeleteGoal, useUpdateGoal } from '@/hooks/useGoals';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { GoalForm } from '@/components/goals/GoalForm';
import { cn } from '@/lib/utils';

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: goals, isLoading } = useGoals();
  const { mutate: deleteGoal } = useDeleteGoal();
  const { mutate: updateGoal } = useUpdateGoal();

  const active = (goals ?? []).filter((g) => !g.isCompleted);
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
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}</div>
      ) : active.length === 0 && completed.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set a savings goal and track your progress" action={{ label: 'Create Goal', onClick: () => setShowForm(true) }} />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map((goal) => {
                const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
                const daysLeft = getDaysUntil(goal.targetDate);
                const monthsLeft = Math.max(Math.ceil(daysLeft / 30), 1);
                const remaining = goal.targetAmount - goal.currentAmount;
                return (
                  <div key={goal.id} className="glass-card-hover rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: goal.color ? `${goal.color}20` : 'rgba(124,58,237,0.1)' }}>
                          {goal.icon ?? '🎯'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{goal.name}</p>
                          <p className="text-xs text-text-muted">Target: {formatDate(goal.targetDate, 'MMM yyyy')}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="text-text-muted hover:text-danger text-xs transition-colors">✕</button>
                    </div>
                    <div>
                      <div className="flex items-end justify-between mb-2">
                        <p className="text-xs text-text-secondary">Progress</p>
                        <p className="text-xs font-medium text-text-primary">{pct.toFixed(1)}%</p>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Saved</p>
                        <p className="text-sm font-semibold font-mono text-text-primary">{formatCurrency(goal.currentAmount, 'INR', true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">Target</p>
                        <p className="text-sm font-semibold font-mono text-text-primary">{formatCurrency(goal.targetAmount, 'INR', true)}</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-bg-elevated text-center">
                      <p className="text-xs text-text-secondary">
                        Save <span className="text-accent-violet-light font-semibold">{formatCurrency(remaining / monthsLeft, 'INR', true)}/month</span> to reach your goal
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Completed</h3>
              <div className="grid grid-cols-2 gap-3">
                {completed.map((goal) => (
                  <div key={goal.id} className="glass-card rounded-2xl p-4 opacity-60 flex items-center gap-3">
                    <span className="text-xl">{goal.icon ?? '✅'}</span>
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
