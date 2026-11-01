 'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Building2, ChevronDown, ShieldCheck, Wallet, X } from 'lucide-react';
import { useAccountFunding, type FundingAccount, type FundingPayment } from '@/hooks/useAccountFunding';
import { formatCurrency, formatDate } from '@/lib/format';

const focusStyle = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono focus-visible:ring-offset-2';

function statusLabel(account: FundingAccount) {
  if (account.status === 'FUND_SOON') return 'Fund soon';
  if (account.status === 'SHORT') return 'Needs funding';
  if (account.status === 'SURPLUS') return 'Surplus available';
  if (account.status === 'NO_UPCOMING_PAYMENTS') return 'No upcoming payments';
  return 'Ready';
}

function Amount({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0">
    <dt className="text-xs text-ink-muted">{label}</dt>
    <dd className="mt-1 text-sm font-semibold tabular-nums text-ink-primary break-words">{formatCurrency(value)}</dd>
  </div>;
}

function Disclosure({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <details className="group/disclosure border-t border-line first:border-t-0">
    <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm text-ink-primary [&::-webkit-details-marker]:hidden ${focusStyle}`}>
      <span><span className="font-medium">{title}</span>{subtitle && <span className="mt-1 block text-xs font-normal text-ink-muted">{subtitle}</span>}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open/disclosure:rotate-180" />
    </summary>
    <div className="pb-4">{children}</div>
  </details>;
}

function PaymentRows({ payments, unassigned = false }: { payments: FundingPayment[]; unassigned?: boolean }) {
  return <ul className="divide-y divide-line">
    {payments.map(payment => <li key={`${payment.type}:${payment.id}:${payment.dueDate}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium text-ink-primary break-words">{payment.name}</p>
        <p className="mt-1 text-xs text-ink-muted">{payment.dueDate ? formatDate(payment.dueDate, 'd MMM yyyy') : 'Date not configured'}{payment.overdue && <span className="ml-2 text-amber-700">Overdue</span>}</p>
      </div>
      <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(payment.amount)}</span>
      {unassigned && <Link className={`inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink-primary ${focusStyle}`} href={payment.type === 'BILL' ? '/bills' : payment.type === 'INVESTMENT' ? '/investments' : '/loans'}>Link account <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>}
    </li>)}
  </ul>;
}

function AccountCard({ account, today, expanded, onToggle }: { account: FundingAccount; today: string; expanded: boolean; onToggle: () => void }) {
  const next = account.nextPayment;
  return <article className={`flex h-full flex-col rounded-xl border bg-paper-card transition-colors ${expanded ? 'border-line-strong' : 'border-line'}`}>
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <div className="flex min-h-[60px] items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-subtle"><Building2 aria-hidden="true" className="h-4 w-4 text-mono" /></div>
        <div className="min-w-0 flex-1">
          <h3 title={account.name} className="line-clamp-2 text-sm font-semibold text-ink-primary break-words">{account.name}</h3>
          <p title={[account.bankName, account.owner].filter(Boolean).join(" / ")} className="mt-1 truncate text-xs text-ink-muted">{account.bankName && <>{account.bankName} &middot; </>}{account.owner}</p>
        </div>
      </div>
      <div className="mt-4 min-h-7">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${account.amountToAdd > 0 ? 'bg-amber-50 text-amber-800' : 'bg-paper-subtle text-ink-secondary'}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${account.amountToAdd > 0 ? 'bg-amber-600' : 'bg-ink-muted'}`} />{statusLabel(account)}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-xs text-ink-muted">Need to add</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-ink-primary break-words">{formatCurrency(account.amountToAdd)}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Amount label="Current balance" value={account.currentBalance} />
        <Amount label="Target balance" value={account.targetBalance} />
      </dl>
      <div className="mt-4 min-h-[76px] flex-1 border-t border-line pt-3">
        <p className="text-[11px] font-medium text-ink-muted">Next debit</p>
        <p title={next?.name} className="mt-1 line-clamp-2 text-xs font-medium text-ink-primary break-words">{next?.name ?? 'No scheduled debit'}</p>
        <p className="mt-1 min-h-4 text-xs text-ink-muted">{next ? <>{formatCurrency(next.amount)} &middot; {next.dueDate && formatDate(next.dueDate, 'd MMM')}{next.overdue ? <span className="text-amber-700"> &middot; Overdue</span> : next.dueDate === today ? ' / Today' : ''}</> : 'Safety balance still applies'}</p>
      </div>
    </div>
    <button id={`funding-toggle-${account.id}`} type="button" aria-expanded={expanded} aria-controls="funding-account-details" onClick={onToggle} className={`flex w-full items-center justify-between gap-2 rounded-b-xl border-t border-line bg-paper-subtle/50 px-4 py-3 text-xs font-medium text-ink-secondary transition-colors hover:bg-paper-subtle hover:text-ink-primary sm:px-5 ${focusStyle}`}>
      <span>{expanded ? 'Hide details' : 'View funding details'}<span className="sr-only"> for {account.name}</span></span>
      <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  </article>;
}

export function AccountFundingPlan() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useAccountFunding();
  if (isLoading) return <div aria-label="Loading funding plan" className="card-light rounded-2xl h-64 shimmer" />;
  if (isError || !data) return <section role="alert" className="card-light rounded-2xl p-5 text-sm text-ink-secondary">Could not load the funding plan. <button onClick={() => refetch()} className={`underline ${focusStyle}`}>Retry</button></section>;
  const expanded = data.accounts.find(account => account.id === expandedId);
  const metrics = [
    { label: 'Still need to allocate', value: data.totals.toAllocate, icon: ArrowDownToLine },
    { label: 'Total target balance', value: data.totals.required, icon: ShieldCheck },
    { label: 'Currently available', value: data.totals.available, icon: Wallet },
    { label: 'Safe surplus', value: data.totals.surplus, icon: ArrowLeftRight },
  ];

  return <section aria-labelledby="funding-title" className="card-light rounded-2xl p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="funding-title" className="text-sm font-semibold text-ink-primary">Account Funding Plan</h2>
        <p className="mt-1 text-xs text-ink-muted">Keep each account ready through {formatDate(data.end, 'd MMM yyyy')}</p>
      </div>
      <Link href="/settings" className={`inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink-primary ${focusStyle}`}>Manage accounts <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
    </div>

    <div className="my-5 grid grid-cols-2 gap-4 rounded-xl bg-paper-subtle/60 p-4 lg:grid-cols-4 lg:gap-6">
      {metrics.map(({ label, value, icon: Icon }) => <div key={label} className="min-w-0">
        <div className="flex min-h-8 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-card"><Icon aria-hidden="true" className="h-3.5 w-3.5 text-mono" /></div>
          <p className="text-xs text-ink-muted">{label}</p>
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums text-ink-primary break-words sm:text-2xl">{formatCurrency(value)}</p>
      </div>)}
    </div>

    {data.accounts.length === 0 ? <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <Building2 aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-ink-muted" />
      <p className="text-sm text-ink-secondary">Add an active INR savings or checking account to start planning.</p>
      <Link href="/settings" className={`mt-3 inline-block text-xs font-medium text-ink-primary underline ${focusStyle}`}>Add an account</Link>
    </div> : <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.accounts.map(account => <AccountCard key={account.id} account={account} today={data.today} expanded={expanded?.id === account.id} onToggle={() => setExpandedId(current => current === account.id ? null : account.id)} />)}
    </div>}

    <div id="funding-account-details" hidden={!expanded} className="mt-4 rounded-xl border border-line bg-paper-subtle/40 p-4 sm:p-5">
      {expanded && <section aria-labelledby="funding-details-title">
        <div className="flex items-start justify-between gap-3">
          <div><h3 id="funding-details-title" className="text-sm font-semibold text-ink-primary">{expanded.name} / Funding details</h3><p className="mt-1 text-xs text-ink-muted">{expanded.owner} &middot; {expanded.payments.length} outstanding payments</p></div>
          <button type="button" aria-label="Close funding details" onClick={() => { setExpandedId(null); document.getElementById(`funding-toggle-${expanded.id}`)?.focus(); }} className={`rounded-lg p-1 text-ink-muted hover:bg-paper-subtle hover:text-ink-primary ${focusStyle}`}><X aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <dl className="my-4 grid grid-cols-2 gap-4 border-y border-line py-4 sm:grid-cols-3 lg:grid-cols-6">
          <Amount label="Scheduled payments" value={expanded.upcomingObligations} />
          <Amount label="Safety balance" value={expanded.preferredMinimum} />
          <Amount label="Due next 7 days" value={expanded.dueNext7Days} />
          <Amount label="Remaining this month" value={expanded.remainingThisMonth} />
          <Amount label="Overdue unpaid" value={expanded.overdue} />
          <Amount label="Safe surplus" value={expanded.surplus} />
        </dl>
        <div className="rounded-lg border border-line bg-paper-card p-4">
          {expanded.payments.length ? <PaymentRows payments={expanded.payments} /> : <p className="text-sm text-ink-muted">No unpaid payments in this funding period.</p>}
        </div>
        <p className="mt-3 text-xs text-ink-muted">Target uses the higher of {formatCurrency(expanded.upcomingObligations)} in scheduled payments and {formatCurrency(expanded.preferredMinimum)} safety balance.</p>
      </section>}
    </div>

    {data.unassigned.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 px-4">
      <Disclosure title={`${formatCurrency(data.totals.unassigned)} needs a payment account`} subtitle={`${data.unassigned.length} payments are additional to the account targets above. Expand to link them.`}>
        <PaymentRows payments={data.unassigned} unassigned />
      </Disclosure>
    </div>}

    <div className="mt-5">
      {data.transfers.length > 0 && <Disclosure title="Suggested transfers from surplus" subtitle={`${formatCurrency(Math.max(0, data.totals.toAllocate - data.totals.surplus))} additional cash needed after using available surplus`}>
        <ul className="divide-y divide-line rounded-xl bg-paper-subtle/60 px-4">
          {data.transfers.map(transfer => <li key={`${transfer.fromId}:${transfer.toId}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm text-ink-secondary">{transfer.from} <span className="mx-1 text-ink-muted">&rarr;</span> {transfer.to}</span><span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(transfer.amount)}</span></li>)}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Suggestions only. Each source account retains its target balance. No money is moved.</p>
      </Disclosure>}
      <Disclosure title="How the funding plan works">
        <div className="grid gap-4 text-xs leading-relaxed text-ink-secondary sm:grid-cols-2">
          <div><p className="font-medium text-ink-primary">Balances and time period</p><p className="mt-1">Target is the higher of unpaid scheduled payments and safety balance. Amount to add is target minus current balance, floored at zero. The horizon covers month end or the next seven days, whichever is later.</p><p className="mt-2">Seven days includes today and the next six days. Loans and recurring investments use their configured payment day, falling back to the original start or purchase day. Short months use the last day.</p></div>
          <div><p className="font-medium text-ink-primary">What is included</p><p className="mt-1">Paid, skipped and inactive payments are excluded. Known overdue bills are included. Historical loan/SIP arrears and salary dates are not recorded by the app.</p><p className="mt-2">Card statements and card EMIs follow the monthly plan&apos;s separate commitments. Avoid including the same EMI in both. Card-charged bills are excluded from direct bank debits.</p></div>
        </div>
      </Disclosure>
    </div>
  </section>;
}
