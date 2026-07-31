'use client';

import { Sparkles, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { useDashboardOverview } from '@/hooks/useDashboard';

/**
 * The old SafeToSaveBreakdown showed all three tips at once as a click-to-
 * expand accordion. Per the redesign brief, the forecast alert (a genuinely
 * personalized insight, see BurnRateCard) plus at most one savings tip is
 * the cap for this page's advisor stack -- anything else belongs on
 * Analytics. The one tip shown is picked by the same savings-health band
 * SafeToSaveBreakdown already computed, not random.
 */
const TIPS = {
  conscious: {
    icon: ShieldCheck, iconBg: 'bg-success/15', iconText: 'text-success',
    title: 'High-Yield Emergency Fund',
    desc: 'Lock 3 to 6 months of living expenses in an accessible high-yield savings account or liquid fund, so you never have to break an investment during an emergency.',
  },
  healthy: {
    icon: Target, iconBg: 'bg-accent-violet/15', iconText: 'text-accent-violet-light',
    title: 'Target Active Financial Goals',
    desc: 'Allocate your safe-to-save surplus directly into your active goals — Travel, Gadgets, a down payment — to accelerate how fast you reach them.',
  },
  super: {
    icon: TrendingUp, iconBg: 'bg-warning/15', iconText: 'text-warning',
    title: 'Automated Investing',
    desc: 'Set up an auto-sweep deposit or recurring SIP that executes a day after your salary arrives, so saving happens before spending gets the chance to.',
  },
} as const;

export function BudgetsAIInsightStack() {
  const { data: overview, isLoading } = useDashboardOverview();
  if (isLoading || !overview || overview.monthlyIncome <= 0) return null;

  const rate = (overview.remainingSafeToSave / overview.monthlyIncome) * 100;
  const tip = rate >= 30 ? TIPS.super : rate >= 15 ? TIPS.healthy : TIPS.conscious;
  const Icon = tip.icon;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">AI Advisor</h3>
      </div>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full ${tip.iconBg} ${tip.iconText} flex items-center justify-center shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-primary">{tip.title}</p>
          <p className="text-xs text-text-secondary leading-relaxed mt-0.5">{tip.desc}</p>
        </div>
      </div>
    </div>
  );
}
