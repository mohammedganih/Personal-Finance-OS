'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { createTransferSchema } from '@shazah/shared';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateTransfer } from '@/hooks/useTransactions';
import { Account } from '@/types';

/** Money moved between two of our own accounts: not income, not spending. */
export function TransferFields({ onClose }: { onClose: () => void }) {
  const { data: accounts } = useAccounts();
  const { mutate: transfer, isPending } = useCreateTransfer();
  const [fromAccountId, setFrom] = useState('');
  const [toAccountId, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createTransferSchema.safeParse({ fromAccountId, toAccountId, amount: Number(amount), date, note: note || undefined });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the details'); return; }
    setError(null);
    transfer(parsed.data, { onSuccess: onClose });
  };

  const options = (accounts as Account[] | undefined) ?? [];
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>From</Label>
          <Select value={fromAccountId} onValueChange={setFrom}>
            <SelectTrigger aria-label="From account"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{options.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Select value={toAccountId} onValueChange={setTo}>
            <SelectTrigger aria-label="To account"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{options.filter((a) => a.id !== fromAccountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Note <span className="text-text-muted font-normal">(optional)</span></Label>
        <Input placeholder="e.g. For the ICICI EMI" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="text-xs text-text-muted">Moves money between your own accounts. It is not counted as income or spending.</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Transfer'}</Button>
      </DialogFooter>
    </form>
  );
}
