'use client';

import { HeartPulse } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useHealthScore } from '@/hooks/useDebtIntelligence';
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
 * The score number itself now leads on DebtFreedomHero -- this card exists
 * to show its reasons, not repeat it, per the same "factors, not just the
 * number" framing the backend's HealthScoreFactor.detail already carries.
 */
export function DebtHealthScore() {
  const { data, isLoading } = useHealthScore();

  if (isLoading) return <div className="glass-card rounded-2xl p-5 h-56 shimmer" />;
  if (!data) return null;

  const cfg = BAND_CONFIG[data.band];

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Debt Health Factors</h3>
        </div>
        <Badge variant={cfg.badge}>{cfg.label}</Badge>
      </div>

      <div className="space-y-3">
        {data.factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary">{f.label}</span>
              <span className="text-xs text-text-muted">{f.detail}</span>
            </div>
            <Progress value={f.score} className="h-1.5" indicatorClassName={factorIndicator(f.score)} />
          </div>
        ))}
      </div>
    </div>
  );
}
