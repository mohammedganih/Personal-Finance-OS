'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateP2PLoan, useUpdateP2PLoan } from '@/hooks/useP2P';
import { Loader2 } from 'lucide-react';
import { P2PLoan } from '@/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  personName:      z.string().min(1, 'Name required'),
  type:            z.enum(['LENT', 'BORROWED']),
  amount:          z.coerce.number().positive('Required'),
  remainingAmount: z.coerce.number().min(0),
  date:            z.string().min(1),
  dueDate:         z.string().optional(),
  description:     z.string().optional(),
  notes:           z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function P2PForm({ onClose, loan }: { onClose: () => void; loan?: P2PLoan }) {
  const isEdit = !!loan;
  const { mutate: create, isPending: isCreating } = useCreateP2PLoan();
  const { mutate: update, isPending: isUpdating } = useUpdateP2PLoan();
  const isPending = isCreating || isUpdating;

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: loan
      ? {
          personName:      loan.personName,
          type:            loan.type,
          amount:          loan.amount,
          remainingAmount: loan.remainingAmount,
          date:            format(new Date(loan.date), 'yyyy-MM-dd'),
          dueDate:         loan.dueDate ? format(new Date(loan.dueDate), 'yyyy-MM-dd') : undefined,
          description:     loan.description ?? '',
          notes:           loan.notes ?? '',
        }
      : { type: 'LENT', date: format(new Date(), 'yyyy-MM-dd') },
  });

  const selectedType = watch('type');

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      update({ id: loan.id, data: data as Record<string, unknown> }, { onSuccess: onClose });
    } else {
      create(data as Record<string, unknown>, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit P2P Entry' : 'Add P2P Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['LENT', 'BORROWED'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  selectedType === t
                    ? t === 'LENT'
                      ? 'bg-success/15 text-success border-success/30'
                      : 'bg-danger/15 text-danger border-danger/30'
                    : 'bg-bg-elevated text-text-secondary border-border'
                )}
              >
                {t === 'LENT' ? '↑ I Lent (they owe me)' : '↓ I Borrowed (I owe them)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{selectedType === 'LENT' ? 'Lent to' : 'Borrowed from'}</Label>
              <Input placeholder="Person's name" {...register('personName')} />
              {errors.personName && <p className="text-xs text-danger">{errors.personName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Original Amount (₹)</Label>
              <Input type="number" step="1" placeholder="10000" {...register('amount')} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Remaining Amount (₹)</Label>
              <Input type="number" step="1" placeholder="10000" {...register('remainingAmount')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expected Return Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Reason / purpose" {...register('description')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
