'use client';

import { addMonths } from 'date-fns';
import { Wallet, CalendarClock, Percent, CalendarCheck } from 'lucide-react';
import { StatCardLight } from '@/components/dashboard/light/StatCardLight';
import { useDebtOverview, useDebtTrend, useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { formatCurrency, formatDate } from '@/lib/format';

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function yearsMonthsLeft(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m > 0 || y === 0) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return `${parts.join(' ')} left`;
}

export function StatsRowLoans() {
  const { data: overview, isLoading } = useDebtOverview();
  const { data: trend } = useDebtTrend(35);
  const { data: strategy } = useDebtStrategy(5000);

  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-28 shimmer" />)}
      </div>
    );
  }

  const points = trend ?? [];
  const current = points[points.length - 1];
  let previous = points[0];
  if (current) {
    const targetDate = new Date(current.date).getTime() - 30 * 24 * 60 * 60 * 1000;
    for (const p of points) {
      if (new Date(p.date).getTime() <= targetDate) previous = p;
    }
  }
  const outstandingDelta = current && previous && previous !== current
    ? pctDelta(current.totalOutstanding, previous.totalOutstanding)
    : null;

  const debtFreeDate = strategy ? addMonths(new Date(), strategy.baseMonths) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardLight
        label="Total Loan Outstanding"
        value={formatCurrency(overview.totalOutstanding, 'INR', true)}
        icon={Wallet}
        subtitle={`Across ${overview.activeLoanCount} active loan${overview.activeLoanCount === 1 ? '' : 's'}`}
        deltaPct={outstandingDelta}
        deltaGoodWhenUp={false}
        emptyHint={outstandingDelta === null ? 'Tracking starts today' : undefined}
      />
      <StatCardLight
        label="Total Monthly EMI"
        value={formatCurrency(overview.totalMonthlyEMI, 'INR', true)}
        icon={CalendarClock}
        emptyHint="Due across all loans"
      />
      <StatCardLight
        label="Interest Payable (Remaining)"
        value={strategy ? formatCurrency(strategy.totalInterestRemaining, 'INR', true) : '—'}
        icon={Percent}
        emptyHint="Across all loans"
      />
      <StatCardLight
        label="Debt Free By"
        value={debtFreeDate ? formatDate(debtFreeDate, 'MMM yyyy') : '—'}
        icon={CalendarCheck}
        emptyHint={strategy ? yearsMonthsLeft(strategy.baseMonths) : undefined}
      />
    </div>
  );
}
