'use client';

import { CalendarClock } from 'lucide-react';
import { useEMICalendar } from '@/hooks/useDebtIntelligence';
import { MonthCalendar } from '@/components/shared/MonthCalendar';
import { DebtSourceType } from '@/types';

const SOURCE_ICON: Record<DebtSourceType, string> = {
  LOAN: '🏦',
  CREDIT_CARD: '💳',
  CARD_EMI: '🛒',
};

export function EMICalendar() {
  const { data, isLoading } = useEMICalendar(3);

  if (isLoading) return <div className="glass-card rounded-2xl h-96 shimmer" />;
  if (!data?.length) return null;

  const events = data.map((e) => ({
    date: e.date,
    label: e.name,
    amount: e.amount,
    icon: SOURCE_ICON[e.sourceType],
  }));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">EMI Calendar</h3>
      </div>
      <MonthCalendar events={events} colorClass="bg-danger" />
    </div>
  );
}
