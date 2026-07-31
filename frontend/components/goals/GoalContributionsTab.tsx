'use client';

import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoalContributions, useDeleteGoalContribution } from '@/hooks/useGoals';
import { GoalContributionForm } from '@/components/goals/GoalContributionForm';

/** Restyled onto the same tile shape used by Transactions and Investments' holdings rows. */
export function GoalContributionsTab({ goalId }: { goalId: string }) {
  const [showForm, setShowForm] = useState(false);
  const { data: contributions, isLoading } = useGoalContributions(goalId);
  const { mutate: deleteContribution } = useDeleteGoalContribution(goalId);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-4">
        <h3 className="text-sm font-semibold text-text-primary">Contributions</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Log Contribution
        </Button>
      </div>

      {isLoading ? (
        <div className="px-5 pb-5 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}</div>
      ) : !contributions?.length ? (
        <p className="text-sm text-text-muted text-center pb-10">No contributions logged yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {contributions.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-bg-elevated/50 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                {c.type === 'RECURRING' ? <RefreshCw className="w-4 h-4 text-success" /> : <Gift className="w-4 h-4 text-success" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-text-primary">{c.type === 'RECURRING' ? 'Auto-contribution' : 'Contribution'}</p>
                  {c.type === 'RECURRING' && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                </div>
                <p className="text-xs text-text-muted truncate mt-0.5">{formatDate(c.date)}{c.notes && ` · ${c.notes}`}</p>
              </div>
              <p className="text-sm font-semibold font-mono text-success shrink-0">+{formatCurrency(c.amount, 'INR', true)}</p>
              <button
                aria-label="Delete contribution"
                onClick={() => deleteContribution(c.id)}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
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
