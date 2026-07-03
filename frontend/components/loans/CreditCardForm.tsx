'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateCreditCard, useUpdateCreditCard } from '@/hooks/useCreditCards';
import { Loader2 } from 'lucide-react';
import { CreditCard } from '@/types';

const schema = z.object({
  cardName:       z.string().min(1, 'Card name required'),
  bank:           z.string().optional(),
  lastFourDigits: z.string().length(4).regex(/^\d{4}$/, 'Must be 4 digits').optional().or(z.literal('')),
  creditLimit:    z.coerce.number().positive('Required'),
  outstanding:    z.coerce.number().min(0).default(0),
  minimumPayment: z.coerce.number().min(0).optional(),
  dueDate:        z.string().min(1, 'Due date required'),
  statementDate:  z.string().optional(),
  interestRate:   z.coerce.number().min(0).max(100).optional(),
  notes:          z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function CreditCardForm({ onClose, card }: { onClose: () => void; card?: CreditCard }) {
  const isEdit = !!card;
  const { mutate: create, isPending: isCreating } = useCreateCreditCard();
  const { mutate: update, isPending: isUpdating } = useUpdateCreditCard();
  const isPending = isCreating || isUpdating;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: card
      ? {
          cardName:       card.cardName,
          bank:           card.bank ?? '',
          lastFourDigits: card.lastFourDigits ?? '',
          creditLimit:    card.creditLimit,
          outstanding:    card.outstanding,
          minimumPayment: card.minimumPayment ?? undefined,
          dueDate:        format(new Date(card.dueDate), 'yyyy-MM-dd'),
          statementDate:  card.statementDate ? format(new Date(card.statementDate), 'yyyy-MM-dd') : undefined,
          interestRate:   card.interestRate ?? undefined,
          notes:          card.notes ?? '',
        }
      : {
          outstanding:  0,
          dueDate:      format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
        },
  });

  const onSubmit = (data: FormData) => {
    const payload = { ...data, lastFourDigits: data.lastFourDigits || undefined };
    if (isEdit) {
      update({ id: card.id, data: payload as Record<string, unknown> }, { onSuccess: onClose });
    } else {
      create(payload as Record<string, unknown>, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Credit Card' : 'Add Credit Card'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Card Name</Label>
              <Input placeholder="e.g. HDFC Regalia" {...register('cardName')} />
              {errors.cardName && <p className="text-xs text-danger">{errors.cardName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bank</Label>
              <Input placeholder="e.g. HDFC, ICICI, SBI" {...register('bank')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Last 4 Digits</Label>
              <Input placeholder="4567" maxLength={4} {...register('lastFourDigits')} />
              {errors.lastFourDigits && <p className="text-xs text-danger">{errors.lastFourDigits.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Interest Rate (% p.a.)</Label>
              <Input type="number" step="0.01" placeholder="36" {...register('interestRate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Credit Limit (₹)</Label>
              <Input type="number" step="1" placeholder="500000" {...register('creditLimit')} />
              {errors.creditLimit && <p className="text-xs text-danger">{errors.creditLimit.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Current Outstanding (₹)</Label>
              <Input type="number" step="1" placeholder="0" {...register('outstanding')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Minimum Payment (₹)</Label>
              <Input type="number" step="1" placeholder="Auto-calculated" {...register('minimumPayment')} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Due Date</Label>
              <Input type="date" {...register('dueDate')} />
              {errors.dueDate && <p className="text-xs text-danger">{errors.dueDate.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Statement Date (optional)</Label>
            <Input type="date" {...register('statementDate')} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Any details..." {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add Card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
