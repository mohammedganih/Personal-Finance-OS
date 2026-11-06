'use client';

import { useState } from 'react';
import { StatsRowBudgets } from '@/components/budgets/StatsRowBudgets';
import { BudgetCategoryTable, BUDGET_TABS, BudgetTab } from '@/components/budgets/BudgetCategoryTable';
import { BudgetOverviewDonut } from '@/components/budgets/BudgetOverviewDonut';
import { TopOverspentCategories } from '@/components/budgets/TopOverspentCategories';
import { BudgetInsightsLight } from '@/components/budgets/BudgetInsightsLight';
import { MonthlyComparisonCard } from '@/components/budgets/MonthlyComparisonCard';

export default function BudgetsPage() {
  // Lifted so "View All" in Top Overspent Categories can jump the table
  // straight to the Over Budget tab, rather than duplicating tab state.
  const [tab, setTab] = useState<BudgetTab>(BUDGET_TABS[0]);

  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowBudgets />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <BudgetCategoryTable tab={tab} onTabChange={setTab} />
        </div>
        <div className="space-y-4">
          <BudgetOverviewDonut />
          <TopOverspentCategories onViewAll={() => setTab('Over Budget')} />
          <BudgetInsightsLight />
          <MonthlyComparisonCard />
        </div>
      </div>
    </div>
  );
}
