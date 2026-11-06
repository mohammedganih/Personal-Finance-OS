'use client';

import { MonthlyPayments } from '@/components/shared/MonthlyPayments';

import { StatsRowLoans } from '@/components/loans/StatsRowLoans';
import { LoanOverviewDonut } from '@/components/loans/LoanOverviewDonut';
import { YourLoansTable } from '@/components/loans/YourLoansTable';
import { DebtHealthGaugeLight } from '@/components/loans/DebtHealthGaugeLight';
import { UpcomingEMIsCard } from '@/components/loans/UpcomingEMIsCard';
import { LoanInsightsLight } from '@/components/loans/LoanInsightsLight';
import { P2PSummaryCard } from '@/components/loans/P2PSummaryCard';

export default function LoansPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowLoans />
      <MonthlyPayments type="LOAN" />

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
