'use client';

import { StatsRowLoans } from '@/components/loans/light/StatsRowLoans';
import { LoanOverviewDonut } from '@/components/loans/light/LoanOverviewDonut';
import { YourLoansTable } from '@/components/loans/light/YourLoansTable';
import { DebtHealthGaugeLight } from '@/components/loans/light/DebtHealthGaugeLight';
import { UpcomingEMIsCard } from '@/components/loans/light/UpcomingEMIsCard';
import { LoanInsightsLight } from '@/components/loans/light/LoanInsightsLight';
import { P2PSummaryCard } from '@/components/loans/light/P2PSummaryCard';

export default function LoansPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowLoans />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <LoanOverviewDonut />
          <YourLoansTable />
        </div>
        <div className="space-y-4">
          <DebtHealthGaugeLight />
          <UpcomingEMIsCard />
          <LoanInsightsLight />
        </div>
      </div>

      <P2PSummaryCard />
    </div>
  );
}
