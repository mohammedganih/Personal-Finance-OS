'use client';

import Link from 'next/link';
import { LineChart, ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { FinancialHero } from '@/components/dashboard/FinancialHero';
import { SnapshotBar } from '@/components/dashboard/SnapshotBar';
import { BudgetOverview } from '@/components/dashboard/BudgetOverview';
import { InvestmentAllocation } from '@/components/dashboard/InvestmentAllocation';
import { GoalProgressCard } from '@/components/dashboard/GoalProgressCard';
import { UpcomingEMIs } from '@/components/dashboard/UpcomingEMIs';
import { HomeEquityCard } from '@/components/dashboard/HomeEquityCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickInsights } from '@/components/dashboard/QuickInsights';

export default function DashboardPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="Dashboard" />

      {/* The hero carries the greeting, the "how am I doing" narrative, and
          the one number that matters most -- net worth. Everything below is
          context, not competition. See the redesign dossier, pass 01. */}
      <FinancialHero />
      <SnapshotBar />

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
