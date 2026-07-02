'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePeriodStore } from '@/stores/period.store';
import { RotateCcw } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEAR_RANGE = 5; // current year back this many years

export function PeriodSelector() {
  const { month, year, setPeriod, resetToCurrentMonth, isCurrentMonth } = usePeriodStore();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEAR_RANGE }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => setPeriod(Number(v), year)}>
        <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((label, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => setPeriod(month, Number(v))}>
        <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isCurrentMonth() && (
        <button
          onClick={resetToCurrentMonth}
          title="Back to this month"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-secondary hover:text-accent-violet-light hover:border-border-strong transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
