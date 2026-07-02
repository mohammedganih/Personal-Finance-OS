'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateSubscription } from '@/hooks/useSubscriptions';
import { Loader2 } from 'lucide-react';
import { BILLING_CYCLE_LABELS } from '@/lib/constants';

const schema = z.object({
  serviceName: z.string().min(1, 'Name required'),
  amount: z.coerce.number().positive(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']),
  renewalDate: z.string().min(1, 'Date required'),
  category: z.string().optional(),
  url: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function SubscriptionForm({ onClose }: { onClose: () => void }) {
  const { mutate: create, isPending } = useCreateSubscription();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { billingCycle: 'MONTHLY', renewalDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd') },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => create(d as Record<string, unknown>, { onSuccess: onClose }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service Name</Label>
              <Input placeholder="e.g. Netflix, Spotify" {...register('serviceName')} />
              {errors.serviceName && <p className="text-xs text-danger">{errors.serviceName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input placeholder="e.g. Entertainment, Tools" {...register('category')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" placeholder="199" {...register('amount')} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select onValueChange={(v) => setValue('billingCycle', v as FormData['billingCycle'])}>
                <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Renewal Date</Label>
              <Input type="date" {...register('renewalDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Website URL (optional)</Label>
              <Input type="url" placeholder="https://" {...register('url')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
