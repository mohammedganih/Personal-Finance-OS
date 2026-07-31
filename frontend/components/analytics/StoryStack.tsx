'use client';

import Link from 'next/link';
import { Sparkles, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useBillsInsights } from '@/hooks/useBills';
import { useFinancialScore } from '@/hooks/useAnalytics';
import { HealthScoreBand } from '@/types';

const BAND_CONFIG: Record<HealthScoreBand, { label: string; badge: 'success' | 'warning' | 'danger' }> = {
  excellent: { label: 'Excellent', badge: 'success' },
  good:      { label: 'Good',      badge: 'success' },
  fair:      { label: 'Fair',      badge: 'warning' },
  poor:      { label: 'Poor',      badge: 'warning' },
  critical:  { label: 'Critical',  badge: 'danger' },
};

function factorIndicator(score: number) {
  if (score >= 70) return 'bg-success';
  if (score >= 40) return 'bg-warning';
  return 'bg-danger';
}

/**
 * Real subscription/bill waste evidence, pulled from the exact insights
 * Bills already computes -- the duplicate-bill flag and the annual-plan
 * nudge for monthly Software/Entertainment bills are the two real matches
 * for "subscription waste"; nothing is invented if neither has fired.
 */
function SubscriptionWasteStory() {
  const { data: insights } = useBillsInsights();
  const match = insights?.find((i) => i.icon === '👯' || i.icon === '💡');
  if (!match) return null;

  return (
    <div className="rounded-xl bg-bg-elevated p-4 flex gap-3">
      <span className="text-lg shrink-0">{match.icon}</span>
      <div className="text-xs text-text-secondary leading-relaxed">
        {match.message}
        <Link href="/bills" className="block mt-1.5 font-semibold text-accent-violet-light hover:underline">
          Review on Bills →
        </Link>
      </div>
    </div>
  );
}

function FinancialScoreStory() {
  const { data, isLoading } = useFinancialScore();
  if (isLoading) return <div className="rounded-xl bg-bg-elevated h-40 shimmer" />;
  if (!data) return null;

  const cfg = BAND_CONFIG[data.band];

  return (
    <div className="rounded-xl bg-bg-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted">Financial Score</p>
          <p className="text-2xl font-bold font-mono text-text-primary tabular-nums mt-0.5">{data.score}</p>
        </div>
        <Badge variant={cfg.badge}>{cfg.label}</Badge>
      </div>
      <p className="text-[11px] text-text-muted">Debt Health + Investment Health + this month&apos;s savings rate, combined.</p>
      <div className="space-y-2">
        {data.components.map((c) => (
          <div key={c.label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-text-secondary">{c.label}</span>
              <span className="text-[10px] text-text-muted">{c.detail}</span>
            </div>
            <Progress value={c.score} className="h-1" indicatorClassName={factorIndicator(c.score)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LifestyleInflationStub() {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-text-muted" />
        <p className="text-xs font-semibold text-text-muted">Lifestyle inflation</p>
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Blocked on an Essential/Lifestyle category tag that doesn&apos;t exist yet — can&apos;t split spend without it.
      </p>
    </div>
  );
}

export function StoryStack() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-violet-light" />
        <h3 className="text-sm font-semibold text-text-primary">Stories</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SubscriptionWasteStory />
        <FinancialScoreStory />
        <LifestyleInflationStub />
      </div>
    </div>
  );
}
