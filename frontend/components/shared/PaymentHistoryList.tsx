'use client';

import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePaymentHistory, useUndoLoanEvent, HistoryType, HistoryEntry } from '@/hooks/usePaymentHistory';
import { useUndoPayment } from '@/hooks/useMonthlyPlan';

export const HISTORY_LABEL: Record<HistoryEntry['kind'], string> = {
  PAID: 'Paid', AUTO: 'Auto-paid', SKIPPED: 'Skipped', PREPAYMENT: 'Prepayment', RATE_CHANGE: 'Rate change', CLOSED: 'Loan closed',
};

/** Every payment, skip and loan change recorded for one item, newest first, with Undo where it is safe. */
export function PaymentHistoryList({ type, id, name, limit }: { type: HistoryType; id: string; name: string; limit?: number }) {
  const { data, isLoading, isError } = usePaymentHistory(type, id);
  const undo = useUndoPayment();
  const undoEvent = useUndoLoanEvent();
  const busy = undo.isPending || undoEvent.isPending;

  const onUndo = (e: HistoryEntry) => {
    if (!window.confirm(`Undo this ${HISTORY_LABEL[e.kind].toLowerCase()} for ${name}?`)) return;
    if (e.eventId) undoEvent.mutate({ loanId: id, eventId: e.eventId });
    else undo.mutate({ type, id, month: e.month ?? undefined, dueDate: e.dueDate });
  };

  if (isLoading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (isError) return <p role="alert" className="text-sm text-updown-down">Could not load the history.</p>;
  if (!data?.length) return <p className="text-sm text-ink-muted">Nothing recorded yet.</p>;
  const shown = limit ? data.slice(0, limit) : data;
  return (
    <>
      <ul className="divide-y divide-line">
        {shown.map((e) => (
          <li key={e.key} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-primary">
                <span className={cn('mr-2 rounded-full px-2 py-0.5 text-[11px]', e.kind === 'SKIPPED' ? 'bg-paper-subtle text-ink-muted' : e.kind === 'CLOSED' || e.kind === 'PAID' || e.kind === 'AUTO' ? 'bg-updown-up-muted text-updown-up' : 'bg-paper-subtle text-ink-secondary')}>{HISTORY_LABEL[e.kind]}</span>
                {e.dueDate ? `Due ${formatDate(e.dueDate, 'd MMM yyyy')}` : e.month ? formatDate(`${e.month}-01`, 'MMM yyyy') : ''}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Recorded {formatDate(e.date, 'd MMM yyyy')}
                {e.amount != null && <> · {formatCurrency(e.amount)}</>}
                {e.note && <> · {e.note}</>}
              </p>
            </div>
            {e.canUndo && (
              <button type="button" disabled={busy} onClick={() => onUndo(e)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-primary hover:bg-paper-subtle disabled:opacity-50">
                Undo
              </button>
            )}
          </li>
        ))}
      </ul>
      {limit && data.length > limit && <p className="mt-1 text-[11px] text-ink-muted">Showing the latest {limit} of {data.length}.</p>}
      {type !== 'INVESTMENT' && type !== 'BILL' && <p className="mt-1 text-[11px] text-ink-muted">Only the most recent payment can be undone, because later ones are worked out from it.</p>}
    </>
  );
}
