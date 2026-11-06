'use client';

import { useState } from 'react';
import { Pencil, Trash2, Archive, Plus } from 'lucide-react';
import { useCardEMIsForCard, useUpdateCardEMI, useDeleteCardEMI } from '@/hooks/useCardEMIs';
import { formatCurrency, formatDate } from '@/lib/format';
import { CardEMIForm } from '@/components/loans/CardEMIForm';
import { CreditCard, CardEMI } from '@/types';

/**
 * A card's EMIs, inside the card's panel. They are billed on the card (so they
 * live here), and Home still counts them under Loans & EMIs. Ticking this
 * month's instalment is done from Home or the statement; progress follows the
 * billing dates.
 */
export function CardEMIList({ card }: { card: CreditCard }) {
  const { data: emis, isLoading } = useCardEMIsForCard(card.id);
  const { mutate: updateEMI } = useUpdateCardEMI();
  const { mutate: deleteEMI } = useDeleteCardEMI();
  const [form, setForm] = useState<{ emi?: CardEMI } | null>(null);
  const active = (emis ?? []).filter((e) => !e.isArchived);

  return (
    <>
      {isLoading ? <div className="h-16 rounded-xl shimmer" /> : active.length === 0 ? (
        <p className="text-sm text-ink-muted">No EMIs on this card.</p>
      ) : (
        <ul className="divide-y divide-line">
          {active.map((emi) => (
            <li key={emi.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-primary">{emi.itemName}</p>
                  <p className="text-xs text-ink-muted">
                    {emi.isNoCost ? 'No-cost' : `${emi.interestRate}% p.a.`} · {emi.emisPaid} of {emi.tenureMonths} billed · from {formatDate(emi.startDate, 'MMM yyyy')}
                    {emi.autoDebit === false && ' · ticked by hand'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(emi.emiAmount)}/mo</p>
                  <p className="text-xs tabular-nums text-ink-muted">{formatCurrency(emi.outstanding)} left</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-subtle"><div className="h-full rounded-full bg-updown-up" style={{ width: `${emi.progressPct}%` }} /></div>
                <button type="button" aria-label={`Edit ${emi.itemName}`} onClick={() => setForm({ emi })} className="rounded-lg p-1 text-ink-muted hover:bg-paper-subtle hover:text-ink-primary"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Archive ${emi.itemName}`} onClick={() => updateEMI({ id: emi.id, data: { isArchived: true } })} className="rounded-lg p-1 text-ink-muted hover:bg-paper-subtle hover:text-ink-primary"><Archive className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Delete ${emi.itemName}`} onClick={() => { if (window.confirm(`Delete ${emi.itemName}?`)) deleteEMI(emi.id); }} className="rounded-lg p-1 text-ink-muted hover:bg-updown-down-muted hover:text-updown-down"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setForm({})} className="mt-2 inline-flex items-center gap-1 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle">
        <Plus className="h-3.5 w-3.5" />Add EMI
      </button>
      {form && <CardEMIForm emi={form.emi} defaultCardId={card.id} onClose={() => setForm(null)} />}
    </>
  );
}
