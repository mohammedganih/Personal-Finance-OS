'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCategories } from '@/hooks/useCategories';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { Account, Category } from '@/types';

// Quick add: log a spend in a few taps from any page. Paid from a bank account
// → an everyday spending entry; paid on a card → a card purchase that lands on
// the card's statement.

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const field = 'w-full rounded-lg border border-line bg-paper-card px-3 py-2 text-sm text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-mono';

function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: accounts } = useAccounts();
  const { data: cards } = useCreditCards();
  const { data: categories } = useCategories();
  const { data: members } = useFamilyMembers();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bankAccounts = ((accounts as Account[] | undefined) ?? []).filter((a) => a.isActive !== false && a.type !== 'CREDIT_CARD');
  const activeCards = (cards ?? []).filter((c) => c.isActive !== false);
  const spendCategories = ((categories as Category[] | undefined) ?? []).filter((c) => c.type === 'EXPENSE');

  useEffect(() => { amountRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Default "paid from" to the first bank account.
  useEffect(() => { if (!from && bankAccounts[0]) setFrom(`account:${bankAccounts[0].id}`); }, [from, bankAccounts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(/[^\d.]/g, ''));
    if (!(value > 0)) { setError('Enter an amount'); return; }
    if (!what.trim()) { setError('Say what it was for'); return; }
    if (!from) { setError('Choose where it was paid from'); return; }
    setError(null); setBusy(true);
    const [kind, id] = from.split(':');
    const category = spendCategories.find((c) => c.id === categoryId);
    try {
      if (kind === 'card') {
        await api.post('/credit-cards/expenses', { creditCardId: id, name: what.trim(), amount: value, date: todayKey(), category: category?.name, memberId: memberId || null });
      } else {
        await api.post('/transactions', { type: 'EXPENSE', amount: value, description: what.trim(), date: todayKey(), accountId: id, categoryId: categoryId || undefined, memberId: memberId || undefined, isRecurring: false });
      }
      qc.invalidateQueries();
      toast({ title: `Added ${what.trim()}` });
      onClose();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add it. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="quick-add-title"
        className="grid w-full max-w-md gap-3 rounded-t-2xl bg-paper-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-soft-hover sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="quick-add-title" className="text-[15px] font-semibold text-ink-primary">Quick add</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-ink-muted hover:bg-paper-subtle"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <label className="grid gap-1 text-xs text-ink-secondary">Amount
            <input ref={amountRef} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹" className={field} />
          </label>
          <label className="grid gap-1 text-xs text-ink-secondary">What
            <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Groceries" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-ink-secondary">Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
              <option value="">None</option>
              {spendCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ink-secondary">Who
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={field}>
              <option value="">Not set</option>
              {(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs text-ink-secondary">Paid from
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
            {bankAccounts.length > 0 && <optgroup label="Bank account">{bankAccounts.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}</optgroup>}
            {activeCards.length > 0 && <optgroup label="Card">{activeCards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.cardName}</option>)}</optgroup>}
          </select>
        </label>
        {error && <p role="alert" className="text-xs text-updown-down">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-full bg-mono py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add'}</button>
      </form>
    </div>
  );
}

/** Floating "+" on every dashboard page. */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add a spend"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-mono text-white shadow-soft-hover hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono focus-visible:ring-offset-2"
      >
        <Plus className="h-6 w-6" />
      </button>
      {open && <QuickAddSheet onClose={() => setOpen(false)} />}
    </>
  );
}
