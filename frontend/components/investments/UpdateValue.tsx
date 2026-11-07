'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useUpdateInvestment } from '@/hooks/useInvestments';
import type { HoldingRow } from '@/hooks/useRegisters';

// SIPs and mutual funds are worth what was paid in until a value is entered.
// This is where that value goes: units × NAV from the statement, or the value
// the fund app shows.

/** One line under the value: where it comes from. */
export function ValueHint({ h, className }: { h: HoldingRow; className?: string }) {
  const v = h.valuation;
  if (!v) return null;
  if (v.atPaidIn) return <span className={cn('block text-xs text-ink-muted', className)}>Valued at amount paid in · <span className="underline">update value</span></span>;
  if (v.needsUpdate) return <span className={cn('block text-xs text-ink-muted', className)}>Value from {formatDate(v.valuedAt!, 'd MMM')} · <span className="underline">update value</span></span>;
  return null;
}

const input = 'mt-1 w-full rounded-xl border border-line bg-paper-card px-3 py-2 text-sm tabular-nums text-ink-primary focus:border-ink-primary focus:outline-none';

export function UpdateValue({ h }: { h: HoldingRow }) {
  const update = useUpdateInvestment();
  const [mode, setMode] = useState<'nav' | 'value'>('nav');
  const [units, setUnits] = useState('');
  const [nav, setNav] = useState('');
  const [value, setValue] = useState('');
  const v = h.valuation;
  if (!v) return null;

  const u = Number(units), n = Number(nav), typed = Number(value);
  const ready = mode === 'nav' ? units !== '' && nav !== '' && u > 0 && n > 0 : value !== '' && typed >= 0 && Number.isFinite(typed);
  const save = () => {
    if (!ready) return;
    const data = mode === 'nav' ? { quantity: u, currentPrice: n } : { currentValue: typed };
    update.mutate({ id: h.id, data }, { onSuccess: () => { setUnits(''); setNav(''); setValue(''); } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-secondary">
        {v.atPaidIn
          ? `No value entered yet, so it counts as the ${formatCurrency(h.invested)} paid in.`
          : `Value entered on ${formatDate(v.valuedAt!, 'd MMM yyyy')}${v.addedSince ? `, plus ${formatCurrency(v.addedSince)} paid in since` : ''}.`}
        {' '}Instalments paid after you enter a value are added on top of it.
      </p>
      <div role="radiogroup" aria-label="How to enter the value" className="inline-flex rounded-full border border-line p-0.5 text-xs">
        {(['nav', 'value'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={cn('rounded-full px-3 py-1 font-medium', mode === m ? 'bg-mono text-white' : 'text-ink-secondary hover:bg-paper-subtle')}>
            {m === 'nav' ? 'Units × NAV' : 'Current value'}
          </button>
        ))}
      </div>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {mode === 'nav' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-ink-muted">Units<input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} className={input} /></label>
            <label className="block text-xs text-ink-muted">NAV (₹)<input inputMode="decimal" value={nav} onChange={(e) => setNav(e.target.value)} className={input} /></label>
          </div>
        ) : (
          <label className="block text-xs text-ink-muted">Value today (₹)<input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={input} /></label>
        )}
        {mode === 'nav' && ready && <p className="text-xs text-ink-muted">Value: {formatCurrency(Math.round(u * n * 100) / 100)}</p>}
        <button type="submit" disabled={!ready || update.isPending} className="rounded-full bg-mono px-4 py-2 text-sm font-medium text-white hover:bg-mono-hover disabled:opacity-50">
          {update.isPending ? 'Saving…' : 'Save value'}
        </button>
      </form>
    </div>
  );
}
