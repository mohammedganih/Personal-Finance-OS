import { CashflowData } from '@/types';

export type ComparisonMode = 'month' | 'year';

export interface ComparisonResult {
  title: string;
  narrative: string;
  deltaAmount: number; // current month's savings minus the comparison month's, signed
  comparisonAvailable: boolean;
  comparisonLabel: string; // "vs last month" | "vs last year"
}

/**
 * Pure function over a cashflow trend (oldest-first, current month last).
 * Requesting a 13-month trend puts the same calendar month a year ago at
 * index 0, so "vs last year" needs no separate endpoint. Every claim here
 * is derived from the trend array itself -- no hardcoded "12% more than
 * July"-style copy, since that was only ever the dossier's illustration.
 */
export function buildComparisonNarrative(trend: CashflowData[], mode: ComparisonMode): ComparisonResult {
  const n = trend.length;
  const current = trend[n - 1];
  const comparisonLabel = mode === 'month' ? 'vs last month' : 'vs last year';

  if (!current) {
    return {
      title: 'Not enough data yet',
      narrative: 'Add a few transactions to see how this period compares.',
      deltaAmount: 0,
      comparisonAvailable: false,
      comparisonLabel,
    };
  }

  const comparison = mode === 'month' ? trend[n - 2] : trend[0];
  const comparisonAvailable = Boolean(comparison) && (comparison.income > 0 || comparison.expenses > 0);

  // Trailing streak of consecutive months (ending at current) with positive savings.
  let streak = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (trend[i].savings > 0) streak++;
    else break;
  }

  // Most recent earlier month (in the fetched window) whose savings matched or beat this one.
  let sinceLabel: string | null = null;
  for (let i = n - 2; i >= 0; i--) {
    if (trend[i].savings >= current.savings) {
      sinceLabel = trend[i].month;
      break;
    }
  }

  let title: string;
  if (current.savings <= 0) {
    title = 'A month to reset.';
  } else if (!sinceLabel) {
    title = n > 1 ? `Your best month in the last ${n - 1}.` : 'Off to a strong start.';
  } else {
    title = `Your best month since ${sinceLabel}.`;
  }

  if (!comparisonAvailable || !comparison) {
    return {
      title,
      narrative: mode === 'year'
        ? "Not enough history yet to compare with the same month last year."
        : 'This is the first month with data — nothing to compare against yet.',
      deltaAmount: 0,
      comparisonAvailable: false,
      comparisonLabel,
    };
  }

  const deltaAmount = current.savings - comparison.savings;
  let narrative: string;
  if (comparison.savings !== 0) {
    const pct = Math.abs((deltaAmount / comparison.savings) * 100);
    narrative = `You saved ${pct.toFixed(0)}% ${deltaAmount >= 0 ? 'more' : 'less'} than ${mode === 'month' ? comparison.month : 'the same month last year'}`;
  } else {
    narrative = `Your savings ${deltaAmount >= 0 ? 'grew' : 'shrank'} compared with ${mode === 'month' ? comparison.month : 'the same month last year'}`;
  }
  if (streak >= 2 && current.savings > 0) {
    narrative += ` — ${streak} months of positive savings in a row.`;
  } else {
    narrative += '.';
  }

  return { title, narrative, deltaAmount, comparisonAvailable, comparisonLabel };
}
