'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { useBillsSummary } from '@/hooks/useBills';
import { BillsHero } from '@/components/bills/BillsHero';
import { PaymentRadar, CommitmentOutlook, FrequencyMix, InsightsPanel } from '@/components/bills/BillsOverviewTab';
import { BillsCalendarTab } from '@/components/bills/BillsCalendarTab';
import { BillsListTab } from '@/components/bills/BillsListTab';
import { BillsAnalyticsTab } from '@/components/bills/BillsAnalyticsTab';
import { BillForm } from '@/components/bills/BillForm';
import { RecurringBill } from '@/types';

export default function BillsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const { data: summary } = useBillsSummary();

  const openCreate = () => { setEditingBill(null); setShowForm(true); };
  const openEdit = (bill: RecurringBill) => { setEditingBill(bill); setShowForm(true); };

  return (
    <PageShell>
      <PageHeader
        title="Bills & Commitments"
        subtitle={`Every recurring payment — subscriptions, utilities, insurance, rent, fees${summary && summary.activeCount > 0 ? ` · ${summary.activeCount} active` : ''}`}
        action={
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Add Bill
          </Button>
        }
      />

      {/* Tier 1: what needs payment next, and how much. */}
      <BillsHero />

      {/* Tier 2: Payment Radar, promoted -- pay/skip inline, no longer sharing the page with four StatCards. */}
      <PaymentRadar />

      {/* Tier 3: planning ahead, for anyone who wants it. */}
      {summary && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <CommitmentOutlook summary={summary} />
            <FrequencyMix summary={summary} />
          </div>
          <InsightsPanel />
        </div>
      )}

      {/* Tier 4: every bill, grouped by status -- a scroll away for auditing, not the landing view. */}
      <BillsListTab onEdit={openEdit} onAdd={openCreate} />

      {/* Calendar and Analytics are sections in the same scroll now, not separate tabs. */}
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-3">Calendar</p>
        <BillsCalendarTab />
      </div>
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-3">Bill Analytics</p>
        <BillsAnalyticsTab />
      </div>

      {showForm && (
        <BillForm
          onClose={() => { setShowForm(false); setEditingBill(null); }}
          bill={editingBill ?? undefined}
        />
      )}
    </PageShell>
  );
}
