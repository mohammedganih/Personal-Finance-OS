'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { usePeriodStore } from '@/stores/period.store';
import { cn } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_BACK = 24;

/**
 * Single combined "MMM yyyy" dropdown, matching the reference design's one
 * control -- unlike the dark PeriodSelector's separate month/year selects.
 * Built directly on @radix-ui/react-select rather than components/ui/select
 * since that shared wrapper hardcodes dark classes with no override props.
 */
export function PeriodSelectorLight() {
  const { month, year, setPeriod } = usePeriodStore();
  const now = new Date();

  const options = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` };
  });

  const value = `${month}-${year}`;

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => {
        const [m, y] = v.split('-').map(Number);
        setPeriod(m, y);
      }}
    >
      <SelectPrimitive.Trigger
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-paper-card px-4 text-sm font-medium text-ink-primary hover:bg-paper-subtle transition-colors focus:outline-none"
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 overflow-hidden rounded-xl border border-line bg-paper-card shadow-soft-hover"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={`${o.month}-${o.year}`}
                value={`${o.month}-${o.year}`}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm text-ink-primary',
                  'focus:bg-paper-subtle focus:outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                )}
              >
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4 text-mono" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
