'use client';

import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCloseMonth, useMonthHistory, HistoryRow } from '@/hooks/useLookback';
import { RegisterPage, RegisterTable, RegisterColumn } from '@/components/register/Register';

// Month history: one row per closed month. A row opens that month's Home sheet.

const btn = 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-paper-subtle disabled:opacity-50';
const money = (n: number) => formatCurrency(Math.round(n));

export default function HistoryPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useMonthHistory();
  const close = useCloseMonth();
  const months = data?.months ?? [];
  const latest = months.find((m) => !m.early) ?? months[0];
  const savedTotal = months.reduce((s, m) => s + m.saved, 0);

  const columns: RegisterColumn<HistoryRow>[] = [
    {
      key: 'month', header: 'Month', className: 'w-[30%] sm:w-[16%]',
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-primary">{formatDate(`${m.month}-01`, 'MMM yyyy')}</p>
          <p className="truncate text-xs text-ink-muted">
            {m.early ? `Closed early, ${formatDate(m.closedAt, 'd MMM')}` : m.approximate ? 'Approximate' : 'Closed'}
          </p>
        </div>
      ),
    },
    { key: 'salary', header: 'Salary', numeric: true, hideOnPhone: true, cell: (m) => money(m.salary) },
    { key: 'commitments', header: 'Commitments', numeric: true, hideOnPhone: true, cell: (m) => money(m.commitments) },
    { key: 'spent', header: 'Spent', numeric: true, hideOnPhone: true, cell: (m) => money(m.spent) },
    {
      key: 'saved', header: 'Saved', numeric: true,
      cell: (m) => (
        <div>
          <p className="text-ink-primary">{money(m.saved)}</p>
          <p className="text-xs text-ink-muted sm:hidden">of {money(m.salary)}</p>
        </div>
      ),
    },
    { key: 'left', header: 'Left over', numeric: true, hideOnPhone: true, cell: (m) => <span className={m.leftOver < 0 ? 'text-updown-down' : undefined}>{money(m.leftOver)}</span> },
    { key: 'nw', header: 'Net worth', numeric: true, cell: (m) => <span className="font-medium text-ink-primary">{money(m.netWorth)}</span> },
  ];

  const thisMonth = data ? formatDate(`${data.currentMonth}-01`, 'MMMM') : 'this month';
  return (
    <RegisterPage
      totals={[
        { label: 'Months closed', value: data ? months.length : '—' },
        { label: 'Latest net worth', value: latest ? money(latest.netWorth) : '—', note: latest ? `end of ${formatDate(`${latest.month}-01`, 'MMM yyyy')}` : undefined },
        { label: 'Saved in these months', value: data ? money(savedTotal) : '—', note: 'into savings and investments' },
      ]}
      actions={
        <button type="button" className={btn} disabled={!data || close.isPending} onClick={() => close.mutate()}>
          {close.isPending ? 'Closing…' : data?.currentClosed ? `Close ${thisMonth} again` : `Close ${thisMonth}`}
        </button>
      }
    >
      {isError && <p className="card-light px-5 py-4 text-sm text-updown-down">Couldn&apos;t load the history. Try again in a moment.</p>}
      {isLoading ? <p className="card-light px-5 py-8 text-center text-sm text-ink-muted">Loading…</p> : (
        <RegisterTable
          title="Closed months"
          columns={columns}
          rows={months}
          rowKey={(m) => m.month}
          onOpen={(m) => router.push(`/dashboard?m=${m.month}`)}
          empty="No month is closed yet. Months close on the 1st, or close this one now."
        />
      )}
      <p className="px-1 text-xs text-ink-muted">
        Commitments are loan EMIs and bills. Spent is card statements and everyday spending. Saved is what went into savings and investments.
        A month closed early is closed again on the 1st with its final figures. Open a month to see its Home sheet.
      </p>
    </RegisterPage>
  );
}
