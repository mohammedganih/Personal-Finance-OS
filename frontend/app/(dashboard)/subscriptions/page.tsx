'use client';

import { useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptions, useDeleteSubscription } from '@/hooks/useSubscriptions';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { BILLING_CYCLE_LABELS } from '@/lib/constants';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { cn } from '@/lib/utils';

export default function SubscriptionsPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: subscriptions, isLoading } = useSubscriptions();
  const { mutate: deleteSub } = useDeleteSubscription();

  const active = (subscriptions ?? []).filter((s) => s.isActive);
  const multipliers: Record<string, number> = { MONTHLY: 1, QUARTERLY: 1/3, HALF_YEARLY: 1/6, YEARLY: 1/12 };
  const monthlyCost = active.reduce((s, sub) => s + sub.amount * (multipliers[sub.billingCycle] || 1), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Subscriptions</h2>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} active</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Subscription
        </Button>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Monthly Cost</p>
            <p className="text-xl font-bold font-mono text-text-primary mt-1">{formatCurrency(monthlyCost)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Annual Cost</p>
            <p className="text-xl font-bold font-mono text-text-primary mt-1">{formatCurrency(monthlyCost * 12, 'INR', true)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Active Services</p>
            <p className="text-xl font-bold text-text-primary mt-1">{active.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)
        ) : active.length === 0 ? (
          <div className="col-span-2">
            <EmptyState icon={Repeat} title="No subscriptions" description="Track Netflix, Spotify, and all your recurring bills" action={{ label: 'Add Subscription', onClick: () => setShowForm(true) }} />
          </div>
        ) : (
          active.map((sub) => {
            const daysLeft = getDaysUntil(sub.renewalDate);
            const isUrgent = daysLeft <= 7;
            return (
              <div key={sub.id} className="glass-card-hover rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-violet/10 flex items-center justify-center text-lg shrink-0">
                  📱
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">{sub.serviceName}</p>
                    {sub.category && <Badge variant="secondary" className="text-xs shrink-0">{sub.category}</Badge>}
                  </div>
                  <p className="text-xs text-text-muted">{BILLING_CYCLE_LABELS[sub.billingCycle]} · Renews {formatDate(sub.renewalDate)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold font-mono text-text-primary">{formatCurrency(sub.amount)}</p>
                  <p className={cn('text-xs', isUrgent ? 'text-danger' : 'text-text-muted')}>
                    {daysLeft <= 0 ? 'Due today' : `${daysLeft}d left`}
                  </p>
                </div>
                <button onClick={() => deleteSub(sub.id)} className="text-text-muted hover:text-danger text-xs ml-2">✕</button>
              </div>
            );
          })
        )}
      </div>

      {showForm && <SubscriptionForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
