'use client';

import { CalendarClock } from 'lucide-react';
import { useInvestmentCalendar } from '@/hooks/useInvestmentIntelligence';
import { MonthCalendar } from '@/components/shared/MonthCalendar';
import { ASSET_TYPE_ICONS } from '@/lib/constants';

export function InvestmentCalendar() {
  const { data, isLoading } = useInvestmentCalendar(3);

  if (isLoading) return <div className="glass-card rounded-2xl h-96 shimmer" />;
  if (!data?.length) return null;

  const events = data.map((e) => ({
    date: e.date,
    label: e.assetName,
    amount: e.amount,
    icon: ASSET_TYPE_ICONS[e.assetType] ?? '💼',
  }));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Investment Calendar</h3>
      </div>
      <MonthCalendar events={events} colorClass="bg-accent-violet" />
    </div>
  );
}
