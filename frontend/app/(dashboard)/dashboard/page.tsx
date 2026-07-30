'use client';

import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, BarChart3, CreditCard,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SafeToSaveBreakdown } from '@/components/dashboard/SafeToSaveBreakdown';
import { BudgetOverview } from '@/components/dashboard/BudgetOverview';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';
import { InvestmentAllocation } from '@/components/dashboard/InvestmentAllocation';
import { GoalProgressCard } from '@/components/dashboard/GoalProgressCard';
import { UpcomingEMIs } from '@/components/dashboard/UpcomingEMIs';
import { HomeEquityCard } from '@/components/dashboard/HomeEquityCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickInsights } from '@/components/dashboard/QuickInsights';
import { FinancialFreedomPlan } from '@/components/dashboard/FinancialFreedomPlan';
import { KPICardSkeleton } from '@/components/shared/LoadingSkeleton';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardPage() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { user } = useAuthStore();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <PageShell width="wide">
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'} 👋`}
        subtitle="Here's your financial snapshot"
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Net Worth"
              value={overview?.netWorth ?? 0}
              icon={Wallet}
              iconColor="bg-accent-violet/15 text-accent-violet-light"
            />
            <StatCard
              title="Monthly Income"
              value={overview?.monthlyIncome ?? 0}
              icon={TrendingUp}
              iconColor="bg-success/15 text-success"
            />
            <StatCard
              title="Monthly Expenses"
              value={overview?.monthlyExpenses ?? 0}
              icon={TrendingDown}
              iconColor="bg-danger/15 text-danger"
            />
            <StatCard
              title="Safe to Save"
              value={overview?.remainingSafeToSave ?? 0}
              icon={PiggyBank}
              iconColor="bg-info/15 text-info"
            />
            <StatCard
              title="Investment Value"
              value={overview?.investmentValue ?? 0}
              icon={BarChart3}
              iconColor="bg-warning/15 text-warning"
            />
            <StatCard
              title="Debt Ratio"
              value={overview?.debtRatio ?? 0}
              icon={CreditCard}
              iconColor="bg-danger/15 text-danger"
              isCurrency={false}
              isPercent
              invertChange
            />
          </>
        )}
      </div>

      <FinancialFreedomPlan />

      {/* Safe to Save Breakdown + Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SafeToSaveBreakdown />
        <BudgetOverview />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashflowChart />
        <ExpensePieChart />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InvestmentAllocation />
        <GoalProgressCard />
        <UpcomingEMIs />
      </div>

      {/* Home Equity -- only renders once a loan is linked to an asset */}
      <HomeEquityCard />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>
        <QuickInsights />
      </div>
    </PageShell>
  );
}
