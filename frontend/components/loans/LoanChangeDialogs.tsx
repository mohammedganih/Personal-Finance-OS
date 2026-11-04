'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAccounts } from '@/hooks/useAccounts';
import { useChangeLoanRate, usePrepayLoan } from '@/hooks/usePaymentHistory';
import { useUpdateCreditCard } from '@/hooks/useCreditCards';
import { CreditCard, Loan } from '@/types';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const field = 'w-full rounded-lg border border-border bg-bg-elevated p-2 text-sm text-text-primary';

/** Pays extra principal. It lowers the balance (the EMI stays the same) and can close the loan. */
export function PrepayLoanDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const prepay = usePrepayLoan();
  const { data: accounts } = useAccounts();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today());
  const n = Number(amount);
  const valid = n > 0 && n <= loan.remainingBalance;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Prepay · {loan.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-text-muted">{formatCurrency(loan.remainingBalance)} left. A prepayment lowers the balance; your EMI stays the same, so the loan ends sooner.</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="prepay-amount">Amount</Label>
            <Input id="prepay-amount" type="number" min={1} max={loan.remainingBalance} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
            {n > loan.remainingBalance && <p className="text-xs text-danger">That is more than what is left.</p>}
            {n > 0 && n <= loan.remainingBalance && <p className="text-xs text-text-muted">New balance {formatCurrency(loan.remainingBalance - n)}{n >= loan.remainingBalance - 1 ? ' (loan closes)' : ''}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prepay-account">Paid from</Label>
            <select id="prepay-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
              <option value="">{loan.bankAccountId ? 'Linked account' : 'No account (cash / other)'}</option>
              {accounts?.filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prepay-date">Paid on</Label>
            <Input id="prepay-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || prepay.isPending} onClick={() => prepay.mutate({ id: loan.id, amount: n, accountId: accountId || undefined, date }, { onSuccess: onClose })}>Record prepayment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Records a new interest rate, and a new EMI if the bank changed it. */
export function ChangeRateDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const change = useChangeLoanRate();
  const [rate, setRate] = useState(String(loan.interestRate));
  const [emi, setEmi] = useState(String(loan.emi));
  const r = Number(rate);
  const e = Number(emi);
  const valid = rate !== '' && r >= 0 && r <= 100 && e > 0 && (r !== loan.interestRate || e !== loan.emi);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change rate · {loan.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-text-muted">Now {loan.interestRate}% with an EMI of {formatCurrency(loan.emi)}. If the bank kept the EMI and changed the tenure instead, leave the EMI as it is.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rate-new">New rate (% a year)</Label>
            <Input id="rate-new" type="number" step="0.01" value={rate} onChange={(ev) => setRate(ev.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-emi">EMI</Label>
            <Input id="rate-emi" type="number" value={emi} onChange={(ev) => setEmi(ev.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || change.isPending} onClick={() => change.mutate({ id: loan.id, interestRate: r, emi: e !== loan.emi ? e : undefined }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A card's statement is out of date when its saved due date has passed. */
export function isStatementStale(card: Pick<CreditCard, 'dueDate'>) {
  return card.dueDate.slice(0, 7) < today().slice(0, 7);
}

/** Monthly statement entry: the amount due, its due date and the statement date. */
export function CardStatementDialog({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const update = useUpdateCreditCard();
  const [amount, setAmount] = useState(isStatementStale(card) ? '' : String(card.outstanding));
  const [dueDate, setDueDate] = useState(isStatementStale(card) ? '' : card.dueDate.slice(0, 10));
  const [statementDate, setStatementDate] = useState(card.statementDate?.slice(0, 10) ?? '');
  const n = Number(amount);
  const valid = amount !== '' && n >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Statement · {card.cardName}</DialogTitle></DialogHeader>
        <p className="text-xs text-text-muted">
          Enter the total from this month&apos;s statement, including EMIs and subscriptions charged to the card. Saved now: {formatCurrency(card.outstanding)} due {formatDate(card.dueDate, 'd MMM yyyy')}.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="st-amount">Statement amount</Label>
            <Input id="st-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="23450" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-due">Due date</Label>
              <Input id="st-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-date">Statement date</Label>
              <Input id="st-date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || update.isPending} onClick={() => update.mutate({ id: card.id, data: { outstanding: n, dueDate, ...(statementDate && { statementDate }) } }, { onSuccess: onClose })}>Save statement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
