'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSetInvestmentSchedule } from '@/hooks/usePaymentHistory';
import { Investment } from '@/types';

const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
const monthLabel = (m: string) => formatDate(`${m}-01`, 'MMM yyyy');

/** One line describing a SIP's pause and upcoming amount change, or null. */
export function scheduleSummary(inv: Pick<Investment, 'pauseFrom' | 'pauseUntil' | 'nextMonthlyAmount' | 'nextAmountFrom'>) {
  const parts: string[] = [];
  if (inv.pauseFrom) parts.push(`Paused ${monthLabel(inv.pauseFrom)}${inv.pauseUntil ? `–${monthLabel(inv.pauseUntil)}` : ' until resumed'}`);
  if (inv.nextAmountFrom && inv.nextMonthlyAmount != null) parts.push(`${formatCurrency(inv.nextMonthlyAmount)} from ${monthLabel(inv.nextAmountFrom)}`);
  return parts.length ? parts.join(' · ') : null;
}

/** Pause a SIP / RD / gold scheme for some months, or change its amount from a month on. */
export function InvestmentScheduleDialog({ investment, onClose }: { investment: Investment; onClose: () => void }) {
  const save = useSetInvestmentSchedule();
  const [pauseFrom, setPauseFrom] = useState(investment.pauseFrom ?? '');
  const [pauseUntil, setPauseUntil] = useState(investment.pauseUntil ?? '');
  const [amount, setAmount] = useState(investment.nextMonthlyAmount != null ? String(investment.nextMonthlyAmount) : '');
  const [amountFrom, setAmountFrom] = useState(investment.nextAmountFrom ?? '');
  const n = Number(amount);
  const amountOk = (!amount && !amountFrom) || (n > 0 && /^\d{4}-\d{2}$/.test(amountFrom));
  const pauseOk = !pauseUntil || (!!pauseFrom && pauseUntil >= pauseFrom);

  const submit = () => save.mutate({
    id: investment.id,
    pauseFrom: pauseFrom || null,
    pauseUntil: pauseFrom && pauseUntil ? pauseUntil : null,
    nextMonthlyAmount: amount ? n : null,
    nextAmountFrom: amount ? amountFrom : null,
  }, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Schedule · {investment.assetName}</DialogTitle></DialogHeader>
        <p className="text-xs text-text-muted">Now {formatCurrency(investment.monthlyAmount ?? 0)} a month. Paused months drop out of the plan and reminders.</p>

        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-xs font-medium text-text-secondary">Pause</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pause-from">From</Label>
              <Input id="pause-from" type="month" min={thisMonth()} value={pauseFrom} onChange={(e) => setPauseFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pause-until">Until (optional)</Label>
              <Input id="pause-until" type="month" min={pauseFrom || thisMonth()} value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} disabled={!pauseFrom} />
            </div>
          </div>
          {!pauseOk && <p className="text-xs text-danger">The pause must end after it starts.</p>}
          {pauseFrom && <button type="button" onClick={() => { setPauseFrom(''); setPauseUntil(''); }} className="text-xs text-text-muted underline">Remove pause</button>}
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-xs font-medium text-text-secondary">Change amount</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="next-amount">New amount</Label>
              <Input id="next-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-from">From</Label>
              <Input id="next-from" type="month" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
            </div>
          </div>
          {!amountOk && <p className="text-xs text-danger">Give both the new amount and the month it starts.</p>}
          {(amount || amountFrom) && <button type="button" onClick={() => { setAmount(''); setAmountFrom(''); }} className="text-xs text-text-muted underline">Remove change</button>}
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!amountOk || !pauseOk || save.isPending} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
