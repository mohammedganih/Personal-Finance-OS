'use client';

import { StatsRow } from '@/components/dashboard/light/StatsRow';
import { CashFlowSankey } from '@/components/dashboard/light/CashFlowSankey';
import { FinancialHealthGauge } from '@/components/dashboard/light/FinancialHealthGauge';
import { UpcomingList } from '@/components/dashboard/light/UpcomingList';
import { GoalProgressLight } from '@/components/dashboard/light/GoalProgressLight';
import { InvestmentsOverviewDonut } from '@/components/dashboard/light/InvestmentsOverviewDonut';
import { AiInsightsLight } from '@/components/dashboard/light/AiInsightsLight';
import { QuickActionsRow } from '@/components/dashboard/light/QuickActionsRow';

// Light-theme Dashboard -- scoped to this route only, see
// app/(dashboard)/layout.tsx. No PageShell/PageHeader here: those are the
// dark design system's chrome, and HeaderLight already carries the
// greeting for this page.
//
// A 4-unit grid per row, but the ratio flips between the two rows: row 1 is
// Cash Flow (wide) / Financial Health / Upcoming (2:1:1), row 2 is Goal
// Progress (narrow) / Investments Overview (wide) / AI Insights (1:2:1) --
// Investments Overview needs the extra width for its Total Value/P&L/All
// Time Return stats alongside the donut, not just the ring.
export default function DashboardPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRow />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        <div className="lg:col-span-2"><CashFlowSankey /></div>
        <FinancialHealthGauge />
        <UpcomingList />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        <GoalProgressLight />
        <div className="lg:col-span-2"><InvestmentsOverviewDonut /></div>
        <AiInsightsLight />
      </div>

      <QuickActionsRow />
    </div>
  );
}
