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
import { useCreateBudget, useUpdateBudget } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { Budget } from '@/types';
import { Loader2 } from 'lucide-react';

// Shared with the backend's createBudgetSchema; only monthlyLimit needs a
// local override since a native number input yields a string. Reused as-is
// in edit mode too -- categoryId stays required by the schema but is seeded
// via defaultValues and never re-picked (updateBudgetSchema intentionally
// excludes it server-side; the category picker just isn't rendered here).
const schema = createBudgetSchema.extend({
  monthlyLimit: z.coerce.number().positive('Monthly limit must be positive'),
});
type FormData = z.infer<typeof schema>;

export function BudgetForm({ existingBudgets, budget, onClose }: { existingBudgets: Budget[]; budget?: Budget; onClose: () => void }) {
  const isEdit = !!budget;
  const { mutate: create, isPending: isCreating } = useCreateBudget();
  const { mutate: update, isPending: isUpdating } = useUpdateBudget();
  const isPending = isCreating || isUpdating;
  const { data: categories } = useCategories();

  const budgetedCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));
  const availableCategories = (categories ?? []).filter(
    (c) => c.type === 'EXPENSE' && !budgetedCategoryIds.has(c.id)
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: budget ? { categoryId: budget.categoryId, monthlyLimit: budget.monthlyLimit } : undefined,
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      update({ id: budget.id, data: { monthlyLimit: data.monthlyLimit } }, { onSuccess: onClose });
    } else {
      create(data as Record<string, unknown>, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Budget' : 'New Budget'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isEdit ? (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <p className="text-sm text-text-primary flex items-center gap-2">
                <span>{budget.category.icon}</span> {budget.category.name}
              </p>
            </div>
          ) : (
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
          )}

          <div className="space-y-1.5">
            <Label>Monthly Limit (₹)</Label>
            <Input type="number" step="1" placeholder="10000" {...register('monthlyLimit')} />
            {errors.monthlyLimit && <p className="text-xs text-danger">{errors.monthlyLimit.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || (!isEdit && availableCategories.length === 0)}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
