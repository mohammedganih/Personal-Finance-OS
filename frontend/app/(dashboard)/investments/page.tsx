'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { ASSET_TYPE_LABELS } from '@/lib/constants';
import { useInvestmentRegister, HoldingRow } from '@/hooks/useRegisters';
import { useInvestments, useDeleteInvestment } from '@/hooks/useInvestments';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { RegisterPage, RegisterTable, RegisterColumn, DetailDrawer, DrawerSection, NextDueCell, Facts } from '@/components/register/Register';
import { PaymentActions } from '@/components/shared/PaymentActions';
import { PaymentHistoryList } from '@/components/shared/PaymentHistoryList';
import { InvestmentForm } from '@/components/investments/InvestmentForm';
import { UpdateValue, ValueHint } from '@/components/investments/UpdateValue';
import { InvestmentScheduleDialog, scheduleSummary } from '@/components/investments/InvestmentScheduleDialog';
import { Investment } from '@/types';

// Savings & investments: what we hold, what goes in each month, what matures when.

const btn = 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-paper-subtle';
const typeLabel = (t: string) => ASSET_TYPE_LABELS[t] ?? t;

export default function InvestmentsPage() {
  const { data, isLoading, isError } = useInvestmentRegister();
  const { data: investments } = useInvestments();
  const { data: members } = useFamilyMembers();
  const remove = useDeleteInvestment();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'edit' | 'schedule'>(null);

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const whose = (h: HoldingRow) => (h.memberId ? `${names.get(h.memberId) ?? 'Someone'}${h.split ? ` & ${names.get(h.split.memberId) ?? 'someone'}` : ''}` : 'Not set');
  const open = data?.holdings.find((h) => h.id === openId) ?? null;
  const full = (investments ?? []).find((i: Investment) => i.id === openId) ?? null;
  const recurring = (data?.holdings ?? []).filter((h) => h.recurring && h.monthly);

  const holdingColumns: RegisterColumn<HoldingRow>[] = [
    {
      key: 'name', header: 'Holding', className: 'w-[42%] sm:w-auto',
      cell: (h) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-primary">{h.name}</p>
          <p className="truncate text-xs text-ink-muted">{typeLabel(h.assetType)} · {whose(h)}</p>
        </div>
      ),
    },
    {
      key: 'value', header: 'Value', numeric: true,
      cell: (h) => {
        const gain = h.value - h.invested;
        return (
          <span>
            <b className="text-ink-primary">{formatCurrency(h.value)}</b>
            {h.invested > 0 && Math.abs(gain) >= 1 && <span className={cn('block text-xs', gain >= 0 ? 'text-updown-up' : 'text-updown-down')}>{gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain))}</span>}
            <ValueHint h={h} />
          </span>
        );
      },
    },
    { key: 'invested', header: 'Put in', numeric: true, hideOnPhone: true, cell: (h) => formatCurrency(h.invested) },
    { key: 'monthly', header: 'A month', numeric: true, hideOnPhone: true, cell: (h) => (h.monthly ? formatCurrency(h.monthly) : <span className="text-ink-muted">—</span>) },
    { key: 'matures', header: 'Matures', hideOnPhone: true, cell: (h) => (h.maturityDate ? formatDate(h.maturityDate, 'd MMM yyyy') : <span className="text-ink-muted">—</span>) },
  ];
  const recurringColumns: RegisterColumn<HoldingRow>[] = [
    { key: 'name', header: 'Instalment', cell: (h) => <span className="font-medium text-ink-primary">{h.name}<span className="block text-xs font-normal text-ink-muted">{typeLabel(h.assetType)}{h.autoDebit ? ' · auto-debit' : ''}</span></span> },
    { key: 'amount', header: 'A month', numeric: true, cell: (h) => formatCurrency(h.next?.amount ?? h.monthly ?? 0) },
    { key: 'next', header: 'This month', cell: (h) => (h.next ? <NextDueCell dueDate={h.next.dueDate} status={h.next.status} /> : <span className="text-xs text-ink-muted">Nothing due</span>) },
  ];

  return (
    <RegisterPage
      totals={[
        { label: 'Total value', value: data ? formatCurrency(data.totals.totalValue) : '—' },
        { label: 'Added this month', value: data ? formatCurrency(data.totals.addedThisMonth) : '—', note: 'instalments and purchases paid' },
        {
          label: 'Next maturity',
          value: data?.totals.nextMaturity ? formatDate(data.totals.nextMaturity.date, 'd MMM yyyy') : '—',
          note: data?.totals.nextMaturity ? `${data.totals.nextMaturity.name}${data.totals.nextMaturity.amount ? ` · ${formatCurrency(data.totals.nextMaturity.amount)}` : ''}` : undefined,
        },
      ]}
    >
      {isLoading && <div className="card-light h-64 shimmer" />}
      {isError && <p role="alert" className="card-light p-5 text-sm text-ink-secondary">Could not load your investments. Please refresh.</p>}
      {data && recurring.length > 0 && (
        <RegisterTable title="Monthly instalments" columns={recurringColumns} rows={recurring} rowKey={(h) => h.id} onOpen={(h) => setOpenId(h.id)} selectedKey={openId} />
      )}
      {data && <RegisterTable title="Holdings" columns={holdingColumns} rows={data.holdings} rowKey={(h) => h.id} onOpen={(h) => setOpenId(h.id)} selectedKey={openId} empty="No investments yet. Add one with the button at the top." />}

      <DetailDrawer open={!!open} onClose={() => { setOpenId(null); setDialog(null); }} title={open?.name} subtitle={open ? `${typeLabel(open.assetType)}${open.platform ? ` · ${open.platform}` : ''}` : undefined}>
        {open && (
          <>
            {open.next && (
              <DrawerSection title={`This month · ${formatDate(`${open.next.period}-01`, 'MMM')}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-subtle px-3 py-2.5">
                  <span className="text-sm"><NextDueCell dueDate={open.next.dueDate} status={open.next.status} /> <b className="ml-1 tabular-nums">{formatCurrency(open.next.amount)}</b></span>
                  <PaymentActions row={open.next} planMonth={open.next.period} />
                </div>
              </DrawerSection>
            )}
            <DrawerSection title="Holding">
              <Facts items={[
                { label: 'Value', value: formatCurrency(open.value) },
                { label: 'Put in so far', value: formatCurrency(open.invested) },
                { label: 'A month', value: open.monthly ? formatCurrency(open.monthly) : '—' },
                { label: 'Whose', value: `${whose(open)}${open.split ? ` (${100 - open.split.pct}/${open.split.pct})` : ''}` },
                ...(open.maturityDate ? [{ label: 'Matures', value: formatDate(open.maturityDate, 'd MMM yyyy') }] : []),
                ...(open.maturityAmount ? [{ label: 'At maturity', value: formatCurrency(open.maturityAmount) }] : []),
              ]} />
              {open.assetType === 'GOLD_SCHEME' && (
                <p className="mt-2 text-xs text-ink-muted">
                  Valued at what has been paid in until it matures.
                  {open.maturityBonus ? ` The scheme adds ${formatCurrency(open.maturityBonus)} on top of your instalments at maturity.` : ''}
                </p>
              )}
              {full && open.recurring && scheduleSummary(full) && <p className="mt-2 text-xs text-ink-muted">{scheduleSummary(full)}</p>}
            </DrawerSection>
            {open.valuation && (
              <DrawerSection title="Update value">
                <UpdateValue key={open.id} h={open} />
              </DrawerSection>
            )}
            {full && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setDialog('edit')}>Edit</button>
                {open.recurring && <button type="button" className={btn} onClick={() => setDialog('schedule')}>Pause or change amount</button>}
                <button type="button" className={`${btn} text-updown-down`} onClick={() => { if (window.confirm(`Delete ${open.name}?`)) remove.mutate(open.id, { onSuccess: () => setOpenId(null) }); }}>Delete</button>
              </div>
            )}
            {open.recurring && (
              <DrawerSection title="Contributions">
                <PaymentHistoryList type="INVESTMENT" id={open.id} name={open.name} limit={24} />
              </DrawerSection>
            )}
          </>
        )}
      </DetailDrawer>
      {full && dialog === 'edit' && <InvestmentForm investment={full} onClose={() => setDialog(null)} />}
      {full && dialog === 'schedule' && <InvestmentScheduleDialog investment={full} onClose={() => setDialog(null)} />}
    </RegisterPage>
  );
}
