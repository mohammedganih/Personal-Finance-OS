'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoalContributions, useDeleteGoalContribution } from '@/hooks/useGoals';
import { GoalContributionForm } from '@/components/goals/GoalContributionForm';

export function GoalContributionsTab({ goalId }: { goalId: string }) {
  const [showForm, setShowForm] = useState(false);
  const { data: contributions, isLoading } = useGoalContributions(goalId);
  const { mutate: deleteContribution } = useDeleteGoalContribution(goalId);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Contribution History</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Log Contribution
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
      ) : !contributions?.length ? (
        <p className="text-sm text-text-muted text-center py-8">No contributions logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {contributions.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold font-mono text-success">+{formatCurrency(c.amount, 'INR', true)}</p>
                  <Badge variant={c.type === 'RECURRING' ? 'default' : 'secondary'} className="text-[10px]">
                    {c.type === 'RECURRING' ? 'Recurring' : 'One-time'}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted mt-0.5">{formatDate(c.date)}{c.notes && ` · ${c.notes}`}</p>
              </div>
              <button
                aria-label="Delete contribution"
                onClick={() => deleteContribution(c.id)}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && <GoalContributionForm goalId={goalId} onClose={() => setShowForm(false)} />}
    </div>
  );
}
