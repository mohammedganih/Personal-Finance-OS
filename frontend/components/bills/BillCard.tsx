'use client';

import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { Archive, ArchiveRestore, Copy, Pause, Pencil, Play, SkipForward, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useDeleteBill,
  useDuplicateBill,
  usePauseBill,
  usePayBillOccurrence,
  useResumeBill,
  useSkipBillOccurrence,
  useUpdateBill,
} from '@/hooks/useBills';
import { formatCurrency, formatDate } from '@/lib/format';
import { BILL_FREQUENCY_LABELS, BILL_FREQUENCY_SHORT, billCategoryMeta } from '@/lib/constants';
import { RecurringBill } from '@/types';
import { cn } from '@/lib/utils';

function dueLabel(dueInDays: number | null): { text: string; className: string } {
  if (dueInDays === null) return { text: 'Nothing scheduled', className: 'text-text-muted' };
  if (dueInDays < 0) return { text: `${Math.abs(dueInDays)}d overdue`, className: 'text-danger font-semibold' };
  if (dueInDays === 0) return { text: 'Due today', className: 'text-danger font-semibold' };
  if (dueInDays <= 7) return { text: `Due in ${dueInDays}d`, className: 'text-warning' };
  return { text: `Due in ${dueInDays}d`, className: 'text-text-muted' };
}

export function BillCard({
  bill,
  onEdit,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  bill: RecurringBill;
  onEdit: (bill: RecurringBill) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<'pay' | 'skip' | 'pause' | 'delete' | null>(null);
  const { mutate: payBill, isPending: isPaying } = usePayBillOccurrence();
  const { mutate: skipBill, isPending: isSkipping } = useSkipBillOccurrence();
  const { mutate: pauseBill } = usePauseBill();
  const { mutate: resumeBill } = useResumeBill();
  const { mutate: duplicateBill } = useDuplicateBill();
  const { mutate: updateBill } = useUpdateBill();
  const { mutate: deleteBill } = useDeleteBill();

  const meta = billCategoryMeta(bill.category);
  const icon = bill.icon || meta.icon;
  const color = bill.color || meta.color;
  const due = dueLabel(bill.dueInDays);
  const isPaused = bill.effectiveStatus === 'PAUSED';
  const isArchived = bill.effectiveStatus === 'ARCHIVED';
  const dueKey = bill.nextDueDate ? bill.nextDueDate.slice(0, 10) : null;

  return (
    <div className={cn('glass-card-hover rounded-2xl p-4 space-y-3', isArchived && 'opacity-60', selected && 'ring-1 ring-accent-violet')}>
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(bill.id)}
            className="mt-2.5 accent-[#9085e9] shrink-0"
            aria-label={`Select ${bill.name}`}
          />
        )}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${color}20` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{bill.name}</p>
            <Badge variant="secondary" className="text-xs shrink-0">{bill.category}</Badge>
            {bill.autoDebit && (
              <span className="inline-flex items-center gap-0.5 text-xs text-accent-violet-light" title="Auto-debit">
                <Zap className="w-3 h-3" /> auto
              </span>
            )}
            {isPaused && <Badge variant="warning" className="text-xs shrink-0">Paused</Badge>}
            {isArchived && <Badge variant="secondary" className="text-xs shrink-0">Archived</Badge>}
          </div>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {BILL_FREQUENCY_LABELS[bill.frequency]}
            {bill.frequency === 'CUSTOM' && bill.customIntervalDays ? ` (${bill.customIntervalDays}d)` : ''}
            {bill.vendor ? ` · ${bill.vendor}` : ''}
            {bill.paymentMethod ? ` · ${bill.paymentMethod}` : ''}
            {bill.account ? ` · ${bill.account.name}` : bill.creditCard ? ` · ${bill.creditCard.cardName}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold font-mono text-text-primary">
            {formatCurrency(bill.amount)}
            <span className="text-xs text-text-muted font-normal">{BILL_FREQUENCY_SHORT[bill.frequency]}</span>
          </p>
          {bill.frequency !== 'MONTHLY' && bill.monthlyEquivalent > 0 && (
            <p className="text-xs text-text-muted">≈ {formatCurrency(bill.monthlyEquivalent, 'INR', true)}/mo</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs min-w-0">
          {isPaused ? (
            <span className="text-warning">
              Paused {bill.pausedUntil ? `until ${formatDate(bill.pausedUntil)}` : 'until resumed'}
            </span>
          ) : bill.nextDueDate ? (
            <span className="text-text-secondary">
              Next: {formatDate(bill.nextDueDate)} · <span className={due.className}>{due.text}</span>
            </span>
          ) : (
            <span className="text-text-muted">{due.text}</span>
          )}
          {bill.lastPaidDate && (
            <span className="text-text-muted"> · Last paid {formatDate(bill.lastPaidDate, 'dd MMM')}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Pay / Skip with inline confirm */}
          {!isArchived && !isPaused && dueKey && (
            confirming === 'pay' ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Pay {formatCurrency(bill.amount, 'INR', true)}?</span>
                <button
                  onClick={() => { payBill({ id: bill.id, dueDate: dueKey }); setConfirming(null); }}
                  disabled={isPaying}
                  className="px-2 py-1 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors"
                >
                  {isPaying ? '…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirming(null)} className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs">✕</button>
              </span>
            ) : confirming === 'skip' ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Skip this occurrence?</span>
                <button
                  onClick={() => { skipBill({ id: bill.id, dueDate: dueKey }); setConfirming(null); }}
                  disabled={isSkipping}
                  className="px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs font-medium hover:bg-warning/25 transition-colors"
                >
                  {isSkipping ? '…' : 'Skip'}
                </button>
                <button onClick={() => setConfirming(null)} className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs">✕</button>
              </span>
            ) : confirming === 'pause' ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Pause:</span>
                <button
                  onClick={() => { pauseBill({ id: bill.id, pausedUntil: format(addMonths(new Date(), 1), 'yyyy-MM-dd') }); setConfirming(null); }}
                  className="px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs hover:bg-warning/25 transition-colors"
                >
                  1 month
                </button>
                <button
                  onClick={() => { pauseBill({ id: bill.id, pausedUntil: null }); setConfirming(null); }}
                  className="px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs hover:bg-warning/25 transition-colors"
                >
                  Until I resume
                </button>
                <button onClick={() => setConfirming(null)} className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs">✕</button>
              </span>
            ) : confirming === 'delete' ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-danger">Delete bill + history?</span>
                <button
                  onClick={() => { deleteBill(bill.id); setConfirming(null); }}
                  className="px-2 py-1 rounded-lg bg-danger/15 text-danger text-xs font-medium hover:bg-danger/25 transition-colors"
                >
                  Delete
                </button>
                <button onClick={() => setConfirming(null)} className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs">✕</button>
              </span>
            ) : (
              <>
                <button
                  onClick={() => setConfirming('pay')}
                  className="px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                >
                  ✓ Pay
                </button>
                <button
                  onClick={() => setConfirming('skip')}
                  title="Skip this occurrence without deleting the bill"
                  className="p-1.5 rounded-lg text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirming('pause')}
                  title="Pause"
                  className="p-1.5 rounded-lg text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <BillMenuButtons bill={bill} onEdit={onEdit} onDelete={() => setConfirming('delete')} duplicateBill={duplicateBill} updateBill={updateBill} />
              </>
            )
          )}
          {(isPaused || isArchived || !dueKey) && confirming !== 'delete' && (
            <>
              {isPaused && (
                <button
                  onClick={() => resumeBill(bill.id)}
                  className="px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                >
                  <Play className="w-3 h-3 inline mr-1" />Resume
                </button>
              )}
              {isArchived ? (
                <button
                  onClick={() => updateBill({ id: bill.id, data: { status: 'ACTIVE' } })}
                  title="Restore"
                  className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                </button>
              ) : (
                <BillMenuButtons bill={bill} onEdit={onEdit} onDelete={() => setConfirming('delete')} duplicateBill={duplicateBill} updateBill={updateBill} />
              )}
              {isArchived && (
                <button
                  onClick={() => setConfirming('delete')}
                  title="Delete permanently"
                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          {(isPaused || isArchived || !dueKey) && confirming === 'delete' && (
            <span className="flex items-center gap-1">
              <span className="text-xs text-danger">Delete bill + history?</span>
              <button
                onClick={() => { deleteBill(bill.id); setConfirming(null); }}
                className="px-2 py-1 rounded-lg bg-danger/15 text-danger text-xs font-medium hover:bg-danger/25 transition-colors"
              >
                Delete
              </button>
              <button onClick={() => setConfirming(null)} className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs">✕</button>
            </span>
          )}
        </div>
      </div>

      {bill.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {bill.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-elevated text-text-muted">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function BillMenuButtons({
  bill,
  onEdit,
  onDelete,
  duplicateBill,
  updateBill,
}: {
  bill: RecurringBill;
  onEdit: (bill: RecurringBill) => void;
  onDelete: () => void;
  duplicateBill: (id: string) => void;
  updateBill: (vars: { id: string; data: Record<string, unknown> }) => void;
}) {
  return (
    <>
      <button
        aria-label={`Edit ${bill.name}`}
        onClick={() => onEdit(bill)}
        className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        aria-label={`Duplicate ${bill.name}`}
        title="Duplicate"
        onClick={() => duplicateBill(bill.id)}
        className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button
        aria-label={`Archive ${bill.name}`}
        title="Archive (keeps history)"
        onClick={() => updateBill({ id: bill.id, data: { status: 'ARCHIVED' } })}
        className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors"
      >
        <Archive className="w-3.5 h-3.5" />
      </button>
      <button
        aria-label={`Delete ${bill.name}`}
        onClick={onDelete}
        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
