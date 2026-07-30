'use client';

import Link from 'next/link';
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, BarChart3, CreditCard, LineChart, ArrowRight,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { BudgetOverview } from '@/components/dashboard/BudgetOverview';
import { InvestmentAllocation } from '@/components/dashboard/InvestmentAllocation';
import { GoalProgressCard } from '@/components/dashboard/GoalProgressCard';
import { UpcomingEMIs } from '@/components/dashboard/UpcomingEMIs';
import { HomeEquityCard } from '@/components/dashboard/HomeEquityCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickInsights } from '@/components/dashboard/QuickInsights';
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

      {/* Retirement planning (Freedom Plan) and the full Safe-to-Save
          breakdown live on Goals and Budgets respectively -- this page
          stays a glance, not a planning tool. */}
      <Link
        href="/analytics"
        className="glass-card-hover rounded-2xl p-4 flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-violet/10 flex items-center justify-center shrink-0">
            <LineChart className="w-4 h-4 text-accent-violet-light" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">View full analytics</p>
            <p className="text-xs text-text-secondary mt-0.5">Cashflow trends, expense breakdown, and per-person split</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-violet-light group-hover:translate-x-0.5 transition-all" />
      </Link>

      <BudgetOverview />

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
