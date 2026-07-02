'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Tags, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCategorySchema } from '@shazah/shared';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Category, TransactionType } from '@/types';
import { Loader2 } from 'lucide-react';

// Shared with the backend's createCategorySchema; no fields need HTML-input
// coercion here (unlike numeric forms), so it's reused as-is.
const schema = createCategorySchema;
type FormData = z.infer<typeof schema>;

function CategoryForm({
  category,
  defaultType,
  onClose,
}: {
  category?: Category;
  defaultType: TransactionType;
  onClose: () => void;
}) {
  const isEdit = !!category;
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const isPending = createMut.isPending || updateMut.isPending;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? { name: category.name, type: category.type, icon: category.icon ?? '', color: category.color ?? '' }
      : { type: defaultType },
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) updateMut.mutate({ id: category!.id, data }, { onSuccess: onClose });
    else createMut.mutate(data as Record<string, unknown>, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Input placeholder="🏷️" className="w-16 text-center text-xl" {...register('icon')} />
            </div>
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input placeholder="e.g. Pet Care, Side Hustle" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as TransactionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input type="color" className="h-9 p-1" {...register('color')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category, onEdit }: { category: Category; onEdit: () => void }) {
  const deleteMut = useDeleteCategory();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated group">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: category.color ? `${category.color}26` : undefined }}
      >
        {category.icon ?? '🏷️'}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-sm font-semibold text-text-primary truncate">{category.name}</p>
        {category.isDefault && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="w-2.5 h-2.5" /> Default
          </Badge>
        )}
      </div>
      {!category.isDefault && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded text-text-muted hover:text-accent-violet-light transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => deleteMut.mutate(category.id)} className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function CategorySetup() {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeTab, setActiveTab] = useState<TransactionType>('EXPENSE');
  const { data: categories, isLoading } = useCategories();

  const cats = categories ?? [];
  const expenseCats = cats.filter((c) => c.type === 'EXPENSE');
  const incomeCats = cats.filter((c) => c.type === 'INCOME');

  const openCreate = () => { setEditingCategory(null); setShowForm(true); };
  const openEdit = (c: Category) => { setEditingCategory(c); setShowForm(true); };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Categories</h3>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <p className="text-xs text-text-secondary">
        Default categories can&apos;t be renamed or removed. Add your own alongside them.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 glass-card rounded-xl shimmer" />)}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransactionType)}>
          <TabsList>
            <TabsTrigger value="EXPENSE">Expense ({expenseCats.length})</TabsTrigger>
            <TabsTrigger value="INCOME">Income ({incomeCats.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="EXPENSE" className="space-y-2">
            {expenseCats.map((c) => <CategoryRow key={c.id} category={c} onEdit={() => openEdit(c)} />)}
          </TabsContent>
          <TabsContent value="INCOME" className="space-y-2">
            {incomeCats.map((c) => <CategoryRow key={c.id} category={c} onEdit={() => openEdit(c)} />)}
          </TabsContent>
        </Tabs>
      )}

      {showForm && (
        <CategoryForm
          category={editingCategory ?? undefined}
          defaultType={activeTab}
          onClose={() => { setShowForm(false); setEditingCategory(null); }}
        />
      )}
    </div>
  );
}
