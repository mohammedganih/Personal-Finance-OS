'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { useWhereWeStand, useSaveBufferSettings, Buffer } from '@/hooks/useBuffer';
import { useAccounts } from '@/hooks/useAccounts';
import { useGoals, useGoalInsights } from '@/hooks/useGoals';
import { Account } from '@/types';

// Home's "Where we stand": are we better off than last month, is the buffer
// there, how much debt is left and when it ends, and are the goals on track.
// Each row opens the page behind it.

const monthLabel = (month: string) => formatDate(`${month}-01`, 'MMM yyyy');

function Row({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-start justify-between gap-2 rounded-xl px-1 py-3 hover:bg-paper-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono">
      <div className="min-w-0 flex-1">
        <small className="block text-xs text-ink-muted">{label}</small>
        {children}
      </div>
      <ChevronRight aria-hidden="true" className="mt-4 h-4 w-4 shrink-0 text-ink-muted group-hover:text-ink-primary" />
    </Link>
  );
}

function BufferEditor({ buffer, onDone }: { buffer: Buffer; onDone: () => void }) {
  const { data: accounts } = useAccounts();
  const save = useSaveBufferSettings();
  const savings = ((accounts as Account[] | undefined) ?? []).filter((a) => a.isActive !== false && a.type !== 'CREDIT_CARD');
  const [target, setTarget] = useState(buffer.targetIsDefault ? '' : String(buffer.target));
  const [ids, setIds] = useState<string[]>(buffer.accountsAreDefault ? [] : buffer.accounts.map((a) => a.id));
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <form
      className="mb-2 grid gap-2 rounded-xl bg-paper-subtle p-3 text-xs text-ink-secondary"
      onSubmit={(e) => { e.preventDefault(); save.mutate({ bufferTarget: target.trim() ? Number(target.replace(/[^\d.]/g, '')) : null, bufferAccountIds: ids }, { onSuccess: onDone }); }}
    >
      <label className="grid gap-1">
        <span>Target (leave empty for 3 months of commitments, {formatCurrency(buffer.defaultTarget)})</span>
        <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={String(Math.round(buffer.defaultTarget))}
          className="rounded-lg border border-line bg-paper-card px-2 py-1.5 text-sm text-ink-primary" />
      </label>
      <fieldset className="grid gap-1">
        <legend className="mb-1">Accounts that count as buffer (none ticked = all savings accounts)</legend>
        {savings.map((a) => (
          <label key={a.id} className="flex items-center gap-2"><input type="checkbox" checked={ids.includes(a.id)} onChange={() => toggle(a.id)} />{a.name}</label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" disabled={save.isPending} className="rounded-full bg-mono px-3 py-1 font-medium text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={onDone} className="rounded-full border border-line px-3 py-1">Cancel</button>
      </div>
    </form>
  );
}

export function WhereWeStand() {
  const { data, isLoading, isError } = useWhereWeStand();
  const { data: goals } = useGoals();
  const { data: insights } = useGoalInsights();
  const [editing, setEditing] = useState(false);

  const active = (goals ?? []).filter((g) => !g.isCompleted);
  const atRisk = new Set((insights ?? []).filter((i) => i.severity === 'warning').map((i) => i.goalId));
  const onTrack = active.filter((g) => !atRisk.has(g.id)).length;

  return (
    <section className="card-light min-w-0 rounded-2xl px-5 py-[18px]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">Where we stand</h2>
        <span className="text-xs text-ink-muted">Right now</span>
      </div>
      {isLoading && <div className="h-64 rounded-xl shimmer" />}
      {isError && <p role="alert" className="text-sm text-ink-secondary">Could not load this. Please refresh.</p>}
      {data && (
        <div className="divide-y divide-line">
          <Row href="/accounts" label="Net worth">
            <b className="text-[19px] tabular-nums text-ink-primary">{formatCurrency(data.netWorth)}</b>
            {data.netWorthChange ? (
              <span className={cn('block text-xs font-medium', data.netWorthChange.amount >= 0 ? 'text-updown-up' : 'text-updown-down')}>
                {data.netWorthChange.amount >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(data.netWorthChange.amount))} since {monthLabel(data.netWorthChange.sinceMonth)} close
                {data.netWorthChange.approximate && <span className="font-normal text-ink-muted"> (approx.)</span>}
              </span>
            ) : <span className="block text-xs text-ink-muted">Compared with last month once a month is closed</span>}
          </Row>

          <div className="py-3">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <small className="text-xs text-ink-muted">Buffer</small>
              <button type="button" onClick={() => setEditing((e) => !e)} className="text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink-primary">{editing ? 'Close' : 'Edit'}</button>
            </div>
            {editing && <BufferEditor buffer={data.buffer} onDone={() => setEditing(false)} />}
            <Link href="/accounts" className="block rounded-xl px-1 hover:bg-paper-subtle">
              <b className="text-[19px] tabular-nums text-ink-primary">{formatCurrency(data.buffer.amount)}</b>
              <span className="text-xs text-ink-muted"> of {formatCurrency(data.buffer.target)}</span>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round(data.buffer.target > 0 ? Math.min(100, (data.buffer.amount / data.buffer.target) * 100) : 0)} aria-label="Buffer against target">
                <i className={cn('block h-full', data.buffer.amount >= data.buffer.target ? 'bg-updown-up' : 'bg-amber-500')}
                  style={{ width: `${data.buffer.target > 0 ? Math.max(0, Math.min(100, (data.buffer.amount / data.buffer.target) * 100)) : 0}%` }} />
              </div>
              <span className="mt-1 block text-[11px] text-ink-muted">
                {data.buffer.accountsAreDefault ? 'All savings accounts' : data.buffer.accounts.map((a) => a.name).join(', ')}
                {data.buffer.pendingFromBuffer > 0 && `, after ${formatCurrency(data.buffer.pendingFromBuffer)} still due this month`}
                {data.buffer.targetIsDefault && ` · target = 3 months of commitments`}
              </span>
            </Link>
          </div>

          <Row href="/loans" label="Debt left">
            <b className="text-[19px] tabular-nums text-ink-primary">{formatCurrency(data.debt.total)}</b>
            {data.debt.lastEndsMonth && (
              <span className="block text-xs text-ink-muted">Last one ends {monthLabel(data.debt.lastEndsMonth)}{data.debt.lastEndsName ? ` (${data.debt.lastEndsName})` : ''}</span>
            )}
          </Row>

          <Row href="/goals" label="Goals">
            <b className="text-[19px] text-ink-primary">{goals ? (active.length ? `${onTrack} of ${active.length} on track` : 'No active goals') : '—'}</b>
          </Row>
        </div>
      )}
    </section>
  );
}
