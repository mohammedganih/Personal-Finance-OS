 'use client';
import { useState } from 'react';
import { useBills } from '@/hooks/useBills';
import { BillForm } from '@/components/bills/BillForm';
import { RecurringBill } from '@/types';
import { formatCurrency } from '@/lib/format';
export function ManageBills() {
  const { data: bills, isLoading, isError } = useBills();
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const [open, setOpen] = useState(false);
  return <section className="card-light rounded-2xl p-5 space-y-3">
    <div className="flex justify-between items-center"><h3 className="text-sm font-semibold text-ink-primary">Manage all bills</h3><button className="bg-mono text-white rounded-lg px-3 py-2 text-xs" onClick={() => { setEditing(null); setOpen(true); }}>Add bill</button></div>
    {isLoading && <p>Loading bills?</p>}{isError && <p role="alert">Could not load bills.</p>}
    <div className="max-h-80 overflow-auto space-y-2">{bills?.map(bill => <div key={bill.id} className="flex justify-between items-center gap-3 border-t border-line pt-3"><div><p className="text-sm font-medium text-ink-primary">{bill.name}</p><p className="text-xs text-ink-muted">{formatCurrency(bill.amount)} ? {bill.category} ? {bill.effectiveStatus}</p></div><button className="border border-line rounded-lg px-3 py-2 text-xs" onClick={() => { setEditing(bill); setOpen(true); }}>Edit bill</button></div>)}</div>
    {!isLoading && !isError && !bills?.length && <p className="text-sm text-ink-muted">Add your first bill to include it in monthly planning.</p>}
    {open && <BillForm bill={editing ?? undefined} onClose={() => { setOpen(false); setEditing(null); }} />}
  </section>;
}
