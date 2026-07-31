'use client';

import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { ComparisonHero } from '@/components/analytics/ComparisonHero';
import { SavingsTrend } from '@/components/analytics/SavingsTrend';
import { SpendingRhythmHeatmap } from '@/components/analytics/SpendingRhythmHeatmap';
import { MemberSplitSection } from '@/components/analytics/MemberSplitSection';
import { StoryStack } from '@/components/analytics/StoryStack';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';

export default function AnalyticsPage() {
  return (
    <PageShell>
      <PageHeader title="Analytics & Insights" subtitle="What patterns should I know?" />

      {/* Tier 1: how this period stacks up. */}
      <ComparisonHero />

      {/* Tier 2: the longer savings trend behind that comparison. */}
      <SavingsTrend />

      {/* Tier 3: a pattern the user didn't already know. */}
      <SpendingRhythmHeatmap />

      {/* Tier 4: per-person split. */}
      <MemberSplitSection />

      {/* Tier 5: stories worth a second look. */}
      <StoryStack />

      {/* Tier 6: the underlying charts, kept as detail rather than the opener. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashflowChart />
        <ExpensePieChart />
      </div>
    </PageShell>
  );
}
