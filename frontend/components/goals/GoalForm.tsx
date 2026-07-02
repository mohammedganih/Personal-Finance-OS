'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addYears } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateGoal } from '@/hooks/useGoals';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  icon: z.string().optional(),
  targetAmount: z.coerce.number().positive('Must be positive'),
  currentAmount: z.coerce.number().min(0).default(0),
  targetDate: z.string().min(1, 'Date required'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function GoalForm({ onClose }: { onClose: () => void }) {
  const { mutate: create, isPending } = useCreateGoal();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currentAmount: 0, targetDate: format(addYears(new Date(), 1), 'yyyy-MM-dd') },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Goal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => create(d as Record<string, unknown>, { onSuccess: onClose }))} className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Input placeholder="🎯" className="w-16 text-center text-xl" {...register('icon')} />
            </div>
            <div className="space-y-1.5">
              <Label>Goal Name</Label>
              <Input placeholder="e.g. Emergency Fund, Vacation" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Amount</Label>
              <Input type="number" step="1" placeholder="100000" {...register('targetAmount')} />
              {errors.targetAmount && <p className="text-xs text-danger">{errors.targetAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Already Saved</Label>
              <Input type="number" step="1" placeholder="0" {...register('currentAmount')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Target Date</Label>
            <Input type="date" {...register('targetDate')} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="What is this goal for?" {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
