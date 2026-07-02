'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePayCreditCardBill } from '@/hooks/useCreditCards';
import { useAccounts } from '@/hooks/useAccounts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Account } from '@/types';
import { formatCurrency } from '@/lib/format';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayBillDialogProps {
  card: CreditCard;
  onClose: () => void;
}

export function PayBillDialog({ card, onClose }: PayBillDialogProps) {
  const { mutate: pay, isPending } = usePayCreditCardBill();
  const { data: accounts } = useAccounts();

  const [mode, setMode]       = useState<'full' | 'minimum' | 'custom'>('full');
  const [customAmt, setCustomAmt] = useState('');
  const [accountId, setAccountId] = useState<string | undefined>(undefined);

  const fullAmount    = card.outstanding;
  const minimumAmount = card.minimumPayment ?? Math.max(card.outstanding * 0.05, 100);

  const payAmount =
    mode === 'full'    ? fullAmount :
    mode === 'minimum' ? minimumAmount :
    parseFloat(customAmt) || 0;

  const isValid = payAmount > 0 && payAmount <= card.outstanding;

  const handlePay = () => {
    if (!isValid) return;
    pay({ id: card.id, amount: payAmount, accountId }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay Credit Card Bill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card info */}
          <div className="bg-bg-elevated rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {card.cardName}
                {card.lastFourDigits && <span className="text-text-muted font-normal ml-1">···· {card.lastFourDigits}</span>}
              </p>
              <p className="text-xs text-text-muted">{card.bank}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Outstanding</p>
              <p className="text-sm font-bold font-mono text-danger">{formatCurrency(card.outstanding)}</p>
            </div>
          </div>

          {/* Payment mode */}
          <div className="space-y-1.5">
            <Label>Payment Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'full',    label: 'Full',    amount: fullAmount },
                { key: 'minimum', label: 'Minimum', amount: minimumAmount },
                { key: 'custom',  label: 'Custom',  amount: null },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    'flex flex-col items-center py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors',
                    mode === opt.key
                      ? 'bg-accent-violet/15 text-accent-violet-light border-accent-violet/30'
                      : 'bg-bg-elevated text-text-secondary border-border hover:border-border-strong'
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.amount !== null && (
                    <span className="font-mono mt-0.5">{formatCurrency(opt.amount, 'INR', true)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {mode === 'custom' && (
            <div className="space-y-1.5">
              <Label>Enter Amount (₹)</Label>
              <Input
                type="number"
                step="1"
                placeholder={String(Math.round(card.outstanding))}
                value={customAmt}
                onChange={(e) => setCustomAmt(e.target.value)}
                autoFocus
              />
              {parseFloat(customAmt) > card.outstanding && (
                <p className="text-xs text-warning">Cannot exceed outstanding balance of {formatCurrency(card.outstanding)}</p>
              )}
            </div>
          )}

          {/* Account selector */}
          <div className="space-y-1.5">
            <Label>Paying from (optional)</Label>
            <Select onValueChange={(v) => setAccountId(v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {(accounts as Account[] | undefined)?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {isValid && (
            <div className="bg-success/8 border border-success/20 rounded-xl px-3 py-2 flex justify-between text-sm">
              <span className="text-text-secondary">You are paying</span>
              <span className="font-bold font-mono text-success">{formatCurrency(payAmount)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={!isValid || isPending} variant="success">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark as Paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
