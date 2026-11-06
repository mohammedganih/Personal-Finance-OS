'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePeriodStore } from '@/stores/period.store';
import { parseMonthParam, toMonthKey } from '@/lib/monthParam';

/**
 * Keeps the header period and the `?m=YYYY-MM` search param in step, so every
 * part of a page shows the same month and a refresh or shared link keeps it.
 * A new `?m` in the URL (load, back button, a link) wins; otherwise the
 * selected month is written to the URL. No `?m` means the current month.
 */
export function PeriodUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { month, year } = usePeriodStore();
  const lastUrlMonth = useRef<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('m');
    if (fromUrl && fromUrl !== lastUrlMonth.current) {
      lastUrlMonth.current = fromUrl;
      const parsed = parseMonthParam(fromUrl);
      if (parsed) usePeriodStore.getState().setPeriod(parsed.month, parsed.year);
    }
    // Read the store directly: a re-run before the next render must see the month just set.
    const live = usePeriodStore.getState();
    const selected = toMonthKey(live.month, live.year);
    if (fromUrl !== selected) {
      lastUrlMonth.current = selected;
      const params = new URLSearchParams(searchParams.toString());
      params.set('m', selected);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, month, year, pathname, router]);

  return null;
}
