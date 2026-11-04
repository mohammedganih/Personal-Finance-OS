'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Pencil, Trash2, Archive } from 'lucide-react';
import { useCardEMIsForCard, useUpdateCardEMI, useDeleteCardEMI, usePayCardEMI } from '@/hooks/useCardEMIs';
import { formatCurrency, formatDate } from '@/lib/format';
import { CardEMIForm } from '@/components/loans/CardEMIForm';
import { CreditCard, CardEMI } from '@/types';

interface CardEMIsDialogProps {
  card: CreditCard;
  onClose: () => void;
}

/**
 * Preserves CardEMIsGroup's exact CRUD (add/edit/pay/archive/delete) for one
 * card's converted-purchase EMIs, now reached from that card's row menu
 * instead of a permanent page section -- Card EMI totals are folded into
 * the card's combined outstanding everywhere else on this page, but the
 * per-EMI management itself isn't dropped, just relocated.
 */
export function CardEMIsDialog({ card, onClose }: CardEMIsDialogProps) {
  const { data: emis, isLoading } = useCardEMIsForCard(card.id);
  const { mutate: updateEMI } = useUpdateCardEMI();
  const { mutate: deleteEMI } = useDeleteCardEMI();
  const { mutate: payEMI, isPending: isPaying } = usePayCardEMI();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEMI, setEditingEMI] = useState<CardEMI | null>(null);

  const active = (emis ?? []).filter((e) => !e.isArchived);

  return (
    <>
      <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-paper-card border border-line shadow-soft p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <Dialog.Title className="text-base font-semibold text-ink-primary">Card EMIs</Dialog.Title>
                <p className="text-xs text-ink-muted mt-0.5">{card.cardName}{card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingEMI(null); setShowForm(true); }}
                  className="flex items-center gap-1 rounded-full bg-mono hover:bg-mono-hover text-white text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add EMI
                </button>
                <Dialog.Close className="p-1 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              </div>
            </div>

            {isLoading ? (
              <div className="h-24 rounded-xl shimmer" />
            ) : active.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-8">No active EMIs on this card</p>
            ) : (
              <div className="space-y-2.5">
                {active.map((emi) => (
                  <div key={emi.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">{emi.itemName}</p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {emi.isNoCost ? '0% No-Cost' : `${emi.interestRate}% p.a.`} · {emi.emisPaid}/{emi.tenureMonths} paid
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(emi.emiAmount, 'INR', true)}/mo</p>
                        <p className="text-xs text-ink-muted tabular-nums">{formatCurrency(emi.outstanding, 'INR', true)} left</p>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="h-1.5 bg-paper-subtle rounded-full overflow-hidden">
                        <div className="h-full bg-updown-up rounded-full" style={{ width: `${emi.progressPct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[11px] text-ink-muted">Started {formatDate(emi.startDate, 'MMM yyyy')}</span>
                      <div className="flex items-center gap-1">
                        {payingId === emi.id ? (
                          <>
                            <button
                              onClick={() => { payEMI({ id: emi.id }); setPayingId(null); }}
                              disabled={isPaying}
                              className="px-2 py-1 rounded-lg bg-updown-up-muted text-updown-up text-xs font-medium"
                            >
                              {isPaying ? '...' : 'Confirm'}
                            </button>
                            <button onClick={() => setPayingId(null)} className="px-1.5 py-1 rounded-lg text-ink-muted text-xs">✕</button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPayingId(emi.id)}
                            title="Counts this month's instalment as part of the card bill. No money moves."
                            className="px-2 py-1 rounded-lg bg-paper-subtle text-ink-primary text-xs font-medium hover:bg-line transition-colors"
                          >
                            Tick off
                          </button>
                        )}
                        <button aria-label={`Edit ${emi.itemName}`} onClick={() => { setEditingEMI(emi); setShowForm(true); }} className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button aria-label={`Archive ${emi.itemName}`} onClick={() => updateEMI({ id: emi.id, data: { isArchived: true } })} className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button aria-label={`Delete ${emi.itemName}`} onClick={() => deleteEMI(emi.id)} className="p-1.5 rounded-lg text-ink-muted hover:text-updown-down hover:bg-updown-down-muted transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {showForm && (
        <CardEMIForm
          onClose={() => { setShowForm(false); setEditingEMI(null); }}
          emi={editingEMI ?? undefined}
          defaultCardId={card.id}
        />
      )}
    </>
  );
}
