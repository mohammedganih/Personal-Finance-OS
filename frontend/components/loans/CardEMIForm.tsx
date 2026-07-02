'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCardEMI, useUpdateCardEMI } from '@/hooks/useCardEMIs';
import { useCreditCards } from '@/hooks/useCreditCards';
import { Loader2 } from 'lucide-react';
import { CardEMI, CreditCard } from '@/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  creditCardId: z.string().min(1, 'Select a card'),
  itemName:     z.string().min(1, 'Item name required'),
  totalAmount:  z.coerce.number().positive('Required'),
  emiAmount:    z.coerce.number().positive('Required'),
  tenureMonths: z.coerce.number().int().positive('Required'),
  emisPaid:     z.coerce.number().int().min(0).default(0),
  isNoCost:     z.boolean().default(true),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  startDate:    z.string().min(1, 'Required'),
  notes:        z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CardEMIFormProps {
  onClose: () => void;
  emi?: CardEMI;
  defaultCardId?: string;
}

export function CardEMIForm({ onClose, emi, defaultCardId }: CardEMIFormProps) {
  const isEdit = !!emi;
  const { mutate: create, isPending: isCreating } = useCreateCardEMI();
  const { mutate: update, isPending: isUpdating } = useUpdateCardEMI();
  const isPending = isCreating || isUpdating;

  const { data: cards } = useCreditCards();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: emi
      ? {
          creditCardId: emi.creditCardId,
          itemName:     emi.itemName,
          totalAmount:  emi.totalAmount,
          emiAmount:    emi.emiAmount,
          tenureMonths: emi.tenureMonths,
          emisPaid:     emi.emisPaid,
          isNoCost:     emi.isNoCost,
          interestRate: emi.interestRate ?? undefined,
          startDate:    format(new Date(emi.startDate), 'yyyy-MM-dd'),
          notes:        emi.notes ?? '',
        }
      : {
          creditCardId: defaultCardId ?? '',
          isNoCost:     true,
          emisPaid:     0,
          startDate:    format(new Date(), 'yyyy-MM-dd'),
        },
  });

  const isNoCost = watch('isNoCost');
  const totalAmount = watch('totalAmount');
  const tenureMonths = watch('tenureMonths');
  const autoEMI = totalAmount && tenureMonths ? (totalAmount / tenureMonths).toFixed(0) : null;

  const onSubmit = (data: FormData) => {
    const payload = { ...data, interestRate: data.isNoCost ? undefined : data.interestRate };
    if (isEdit) {
      update({ id: emi.id, data: payload as Record<string, unknown> }, { onSuccess: onClose });
    } else {
      create(payload as Record<string, unknown>, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Card EMI' : 'Add Card EMI'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Card selector */}
          {!defaultCardId && (
            <div className="space-y-1.5">
              <Label>Credit Card</Label>
              <Select
                defaultValue={emi?.creditCardId}
                onValueChange={(v) => setValue('creditCardId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the card this EMI is on" />
                </SelectTrigger>
                <SelectContent>
                  {(cards as CreditCard[] | undefined)?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cardName}{c.lastFourDigits ? ` ···· ${c.lastFourDigits}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.creditCardId && <p className="text-xs text-danger">{errors.creditCardId.message}</p>}
            </div>
          )}

          {/* Item + type toggle */}
          <div className="space-y-1.5">
            <Label>Item / Purchase Name</Label>
            <Input placeholder="e.g. iPhone 16 Pro, Samsung TV" {...register('itemName')} />
            {errors.itemName && <p className="text-xs text-danger">{errors.itemName.message}</p>}
          </div>

          {/* No-cost vs interest toggle */}
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setValue('isNoCost', val)}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  isNoCost === val
                    ? val
                      ? 'bg-success/15 text-success border-success/30'
                      : 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-bg-elevated text-text-secondary border-border'
                )}
              >
                {val ? '0% No-Cost EMI' : 'Interest-bearing EMI'}
              </button>
            ))}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Total Amount (₹)</Label>
              <Input type="number" step="1" placeholder="60000" {...register('totalAmount')} />
              {errors.totalAmount && <p className="text-xs text-danger">{errors.totalAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months)</Label>
              <Input type="number" step="1" placeholder="6" {...register('tenureMonths')} />
              {errors.tenureMonths && <p className="text-xs text-danger">{errors.tenureMonths.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly EMI (₹)</Label>
              <Input
                type="number"
                step="1"
                placeholder={autoEMI ?? '10000'}
                {...register('emiAmount')}
              />
              {errors.emiAmount && <p className="text-xs text-danger">{errors.emiAmount.message}</p>}
            </div>
          </div>

          {/* Interest rate (only for interest-bearing) */}
          {!isNoCost && (
            <div className="space-y-1.5">
              <Label>Interest Rate (% p.a.)</Label>
              <Input type="number" step="0.01" placeholder="e.g. 15" {...register('interestRate')} />
            </div>
          )}

          {/* EMIs paid + start date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>EMIs Already Paid</Label>
              <Input type="number" step="1" placeholder="0" {...register('emisPaid')} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" {...register('startDate')} />
            </div>
          </div>

          {/* Auto-calc hint */}
          {autoEMI && !isNoCost && (
            <div className="bg-bg-elevated rounded-xl px-3 py-2 text-xs text-text-muted">
              No-cost EMI would be ₹{autoEMI}/mo · enter actual EMI for interest-bearing
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input placeholder="Order ID, occasion, etc." {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isEdit ? 'Save Changes' : 'Add EMI'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
