'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePaymentHistory, useUndoLoanEvent, HistoryType, HistoryEntry } from '@/hooks/usePaymentHistory';
import { useUndoPayment } from '@/hooks/useMonthlyPlan';

const LABEL: Record<HistoryEntry['kind'], string> = {
  PAID: 'Paid', AUTO: 'Auto-paid', SKIPPED: 'Skipped', PREPAYMENT: 'Prepayment', RATE_CHANGE: 'Rate change', CLOSED: 'Loan closed',
};

/** Every payment, skip and loan change recorded for one item, with Undo where it is safe. */
export function PaymentHistoryDialog({ type, id, name, onClose }: { type: HistoryType; id: string; name: string; onClose: () => void }) {
  const { data, isLoading, isError } = usePaymentHistory(type, id);
  const undo = useUndoPayment();
  const undoEvent = useUndoLoanEvent();
  const busy = undo.isPending || undoEvent.isPending;

  const onUndo = (e: HistoryEntry) => {
    if (!window.confirm(`Undo this ${LABEL[e.kind].toLowerCase()} for ${name}?`)) return;
    if (e.eventId) undoEvent.mutate({ loanId: id, eventId: e.eventId });
    else undo.mutate({ type, id, month: e.month ?? undefined, dueDate: e.dueDate });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>History · {name}</DialogTitle></DialogHeader>
        {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {isError && <p role="alert" className="text-sm text-danger">Could not load the history.</p>}
        {data && data.length === 0 && <p className="text-sm text-text-muted">Nothing recorded yet.</p>}
        <ul className="divide-y divide-border">
          {data?.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  <span className={cn('mr-2 rounded-full px-2 py-0.5 text-[11px]', e.kind === 'SKIPPED' ? 'bg-bg-elevated text-text-muted' : e.kind === 'CLOSED' ? 'bg-success-muted text-success' : 'bg-bg-elevated text-text-secondary')}>{LABEL[e.kind]}</span>
                  {e.dueDate ? `Due ${formatDate(e.dueDate, 'd MMM yyyy')}` : e.month ? formatDate(`${e.month}-01`, 'MMM yyyy') : ''}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Recorded {formatDate(e.date, 'd MMM yyyy')}
                  {e.amount != null && <> · {formatCurrency(e.amount)}</>}
                  {e.note && <> · {e.note}</>}
                </p>
              </div>
              {e.canUndo && (
                <button type="button" disabled={busy} onClick={() => onUndo(e)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:bg-bg-elevated disabled:opacity-50">
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
        {type !== 'INVESTMENT' && type !== 'BILL' && <p className="text-[11px] text-text-muted">Only the most recent payment can be undone, because later ones are worked out from it.</p>}
      </DialogContent>
    </Dialog>
  );
}
