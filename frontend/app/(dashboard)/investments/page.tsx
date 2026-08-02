'use client';

import { useState } from 'react';
import { useDeleteInvestment } from '@/hooks/useInvestments';
import { InvestmentForm } from '@/components/investments/InvestmentForm';
import { InvestmentDetailDialog } from '@/components/investments/InvestmentDetailDialog';
import { StatsRowInvestments } from '@/components/investments/light/StatsRowInvestments';
import { PortfolioPerformanceChart } from '@/components/investments/light/PortfolioPerformanceChart';
import { AssetAllocationLight } from '@/components/investments/light/AssetAllocationLight';
import { HoldingsTable } from '@/components/investments/light/HoldingsTable';
import { InvestmentInsightsLight } from '@/components/investments/light/InvestmentInsightsLight';
import { UpcomingInvestmentsCard } from '@/components/investments/light/UpcomingInvestmentsCard';
import { HoldingBucket } from '@/lib/investmentBuckets';
import { Investment, InvestmentWithPnl } from '@/types';

export default function InvestmentsPage() {
  const [activeBucket, setActiveBucket] = useState<HoldingBucket | 'All'>('All');
  const [viewingInvestment, setViewingInvestment] = useState<InvestmentWithPnl | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const { mutate: deleteInvestment } = useDeleteInvestment();

  const jumpToHoldings = (bucket: HoldingBucket | 'All') => {
    setActiveBucket(bucket);
    document.getElementById('investment-holdings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openEdit = (inv: InvestmentWithPnl) => {
    setViewingInvestment(null);
    setEditingInvestment(inv as Investment);
  };

  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowInvestments />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2"><PortfolioPerformanceChart /></div>
        <AssetAllocationLight onSelectBucket={jumpToHoldings} />
      </div>

      <HoldingsTable
        activeBucket={activeBucket}
        onSelectBucket={setActiveBucket}
        onSelectInvestment={setViewingInvestment}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <InvestmentInsightsLight onReviewAllocation={() => jumpToHoldings('All')} />
        </div>
        <UpcomingInvestmentsCard />
      </div>

      {editingInvestment && (
        <InvestmentForm
          onClose={() => setEditingInvestment(null)}
          investment={editingInvestment}
        />
      )}

      {viewingInvestment && (
        <InvestmentDetailDialog
          investment={viewingInvestment}
          onClose={() => setViewingInvestment(null)}
          onEdit={() => openEdit(viewingInvestment)}
          onDelete={() => { deleteInvestment(viewingInvestment.id); setViewingInvestment(null); }}
        />
      )}
    </div>
  );
}
