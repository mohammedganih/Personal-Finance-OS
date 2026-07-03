'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateGoalContribution } from '@/hooks/useGoals';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  amount: z.coerce.number().positive('Must be positive'),
  date: z.string().min(1, 'Date required'),
  type: z.enum(['ONE_TIME', 'RECURRING']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function GoalContributionForm({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateGoalContribution(goalId);
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), type: 'ONE_TIME' },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log a Contribution</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => create(d as Record<string, unknown>, { onSuccess: onClose }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="1" placeholder="5000" {...register('amount')} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                    <SelectItem value="RECURRING">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input placeholder="e.g. Annual bonus" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Contribution'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
