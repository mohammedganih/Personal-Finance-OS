'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { BILL_FREQUENCY_LABELS } from '@/lib/constants';
import { useBillRegister, BillRow } from '@/hooks/useRegisters';
import { useBills, useDeleteBill, useDuplicateBill, usePauseBill, useResumeBill } from '@/hooks/useBills';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { RegisterPage, RegisterTable, RegisterColumn, DetailDrawer, DrawerSection, NextDueCell, Facts } from '@/components/register/Register';
import { PaymentActions } from '@/components/shared/PaymentActions';
import { PaymentHistoryList } from '@/components/shared/PaymentHistoryList';
import { BillForm } from '@/components/bills/BillForm';
import { RecurringBill } from '@/types';

// Bills & subscriptions: everything that repeats, what it costs a month, what
// is due next and where it is paid from. Yearly bills show what to set aside.

type Filter = 'ALL' | 'SUBSCRIPTIONS' | 'UTILITIES' | 'YEARLY';
const FILTERS: { key: Filter; label: string; test: (b: BillRow) => boolean }[] = [
  { key: 'ALL', label: 'All', test: () => true },
  { key: 'SUBSCRIPTIONS', label: 'Subscriptions', test: (b) => b.subscription },
  { key: 'UTILITIES', label: 'Utilities', test: (b) => b.utility },
  { key: 'YEARLY', label: 'Yearly', test: (b) => b.yearly },
];
const btn = 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-paper-subtle';
const freq = (f: string) => BILL_FREQUENCY_LABELS[f] ?? f.toLowerCase();

export default function BillsPage() {
  const { data, isLoading, isError } = useBillRegister();
  const { data: bills } = useBills();
  const { data: members } = useFamilyMembers();
  const pause = usePauseBill();
  const resume = useResumeBill();
  const duplicate = useDuplicateBill();
  const remove = useDeleteBill();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ bill?: RecurringBill } | null>(null);

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const rows = (data?.bills ?? []).filter(FILTERS.find((f) => f.key === filter)!.test);
  const open = data?.bills.find((b) => b.id === openId) ?? null;
  const full = (bills ?? []).find((b) => b.id === openId) ?? null;

  const columns: RegisterColumn<BillRow>[] = [
    {
      key: 'name', header: 'Bill', className: 'w-[40%] sm:w-auto',
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-primary">{b.name}{b.status === 'PAUSED' && <span className="ml-1.5 rounded-full bg-paper-subtle px-1.5 py-px text-[10.5px] text-ink-muted">paused</span>}</p>
          <p className="truncate text-xs text-ink-muted">{b.category} · {b.payerMemberId ? `${names.get(b.payerMemberId) ?? 'Someone'} pays` : 'No payer set'}</p>
        </div>
      ),
    },
    {
      key: 'amount', header: 'Amount', numeric: true,
      cell: (b) => (
        <span>
          {formatCurrency(b.amount)}<span className="block text-xs text-ink-muted">{freq(b.frequency)}</span>
          {b.setAsidePerMonth != null && <span className="block text-[11px] text-amber-800">set aside {formatCurrency(b.setAsidePerMonth)}/mo</span>}
        </span>
      ),
    },
    { key: 'monthly', header: 'A month', numeric: true, hideOnPhone: true, cell: (b) => formatCurrency(b.monthlyEquivalent) },
    { key: 'next', header: 'Next due', cell: (b) => <NextDueCell dueDate={b.next?.dueDate} status={b.next?.status} /> },
    { key: 'from', header: 'Paid from', hideOnPhone: true, cell: (b) => b.paidFrom ? <span>{b.paidFrom.name}<span className="block text-xs text-ink-muted">{b.paidFrom.kind === 'CARD' ? 'card' : 'bank'}{b.autoDebit ? ' · auto-debit' : ''}</span></span> : <span className="text-ink-muted">Not set</span> },
  ];

  return (
    <RegisterPage
      totals={[
        { label: 'Bills a month', value: data ? formatCurrency(data.totals.monthlyTotal) : '—', note: 'yearly bills spread over 12 months' },
        { label: 'Still due this month', value: data ? formatCurrency(data.totals.dueThisMonthLeft) : '—' },
        { label: 'Yearly & quarterly costs', value: data ? formatCurrency(data.totals.yearlyCosts) : '—', note: data ? `set aside ${formatCurrency(data.totals.yearlySetAside)} a month` : undefined },
      ]}
    >
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', filter === f.key ? 'bg-mono text-white' : 'border border-line-strong text-ink-primary hover:bg-paper-subtle')}>
            {f.label} {data && <span className="opacity-70">{data.bills.filter(f.test).length}</span>}
          </button>
        ))}
      </div>
      {isLoading && <div className="card-light h-64 shimmer" />}
      {isError && <p role="alert" className="card-light p-5 text-sm text-ink-secondary">Could not load your bills. Please refresh.</p>}
      {data && <RegisterTable columns={columns} rows={rows} rowKey={(b) => b.id} onOpen={(b) => setOpenId(b.id)} selectedKey={openId} empty="No bills here." />}

      <DetailDrawer open={!!open} onClose={() => setOpenId(null)} title={open?.name} subtitle={open ? `${open.category}${open.vendor ? ` · ${open.vendor}` : ''}` : undefined}>
        {open && (
          <>
            {open.next && (
              <DrawerSection title="Next">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-subtle px-3 py-2.5">
                  <span className="text-sm"><NextDueCell dueDate={open.next.dueDate} status={open.next.status} /> <b className="ml-1 tabular-nums">{formatCurrency(open.next.amount)}</b></span>
                  <PaymentActions row={open.next} planMonth={open.next.period} />
                </div>
              </DrawerSection>
            )}
            <DrawerSection title="Details">
              <Facts items={[
                { label: 'Amount', value: `${formatCurrency(open.amount)} · ${freq(open.frequency)}` },
                { label: 'A month', value: formatCurrency(open.monthlyEquivalent) },
                ...(open.setAsidePerMonth != null ? [{ label: 'Set aside each month', value: formatCurrency(open.setAsidePerMonth) }] : []),
                { label: 'Who pays', value: open.payerMemberId ? names.get(open.payerMemberId) ?? 'Someone' : 'Not set' },
                { label: 'Paid from', value: open.paidFrom ? `${open.paidFrom.name} (${open.paidFrom.kind === 'CARD' ? 'card' : 'bank'})` : 'Not set' },
                { label: 'Auto-debit', value: open.autoDebit ? 'Yes' : 'No' },
              ]} />
            </DrawerSection>
            {full && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setForm({ bill: full })}>Edit</button>
                {open.status === 'PAUSED'
                  ? <button type="button" className={btn} onClick={() => resume.mutate(open.id)}>Resume</button>
                  : <button type="button" className={btn} onClick={() => pause.mutate({ id: open.id })}>Pause</button>}
                <button type="button" className={btn} onClick={() => duplicate.mutate(open.id)}>Duplicate</button>
                <button type="button" className={`${btn} text-updown-down`} onClick={() => { if (window.confirm(`Delete ${open.name}?`)) remove.mutate(open.id, { onSuccess: () => setOpenId(null) }); }}>Delete</button>
              </div>
            )}
            <DrawerSection title="History">
              <PaymentHistoryList type="BILL" id={open.id} name={open.name} limit={24} />
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
      {form && <BillForm bill={form.bill} onClose={() => setForm(null)} />}
    </RegisterPage>
  );
}
