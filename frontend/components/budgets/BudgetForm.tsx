'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBudgetSchema } from '@shazah/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBudget } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { Budget } from '@/types';
import { Loader2 } from 'lucide-react';

// Shared with the backend's createBudgetSchema; only monthlyLimit needs a
// local override since a native number input yields a string.
const schema = createBudgetSchema.extend({
  monthlyLimit: z.coerce.number().positive('Monthly limit must be positive'),
});
type FormData = z.infer<typeof schema>;

export function BudgetForm({ existingBudgets, onClose }: { existingBudgets: Budget[]; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateBudget();
  const { data: categories } = useCategories();

  const budgetedCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));
  const availableCategories = (categories ?? []).filter(
    (c) => c.type === 'EXPENSE' && !budgetedCategoryIds.has(c.id)
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    create(data as Record<string, unknown>, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={watch('categoryId')} onValueChange={(v) => setValue('categoryId', v)}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-xs text-danger">Select a category</p>}
            {availableCategories.length === 0 && (
              <p className="text-xs text-text-muted">Every expense category already has a budget.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Monthly Limit (₹)</Label>
            <Input type="number" step="1" placeholder="10000" {...register('monthlyLimit')} />
            {errors.monthlyLimit && <p className="text-xs text-danger">{errors.monthlyLimit.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || availableCategories.length === 0}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
