'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useCategories, useAccounts } from '@/hooks/useAccounts';
import { SplitMemberSelector } from '@/components/shared/MemberSelector';
import { Loader2 } from 'lucide-react';
import { Category, Account, Transaction } from '@/types';

const schema = z.object({
  type:          z.enum(['INCOME', 'EXPENSE']),
  amount:        z.coerce.number().positive('Amount must be positive'),
  description:   z.string().optional(),
  date:          z.string().min(1, 'Date required'),
  categoryId:    z.string().optional(),
  accountId:     z.string().optional(),
  memberId:      z.string().optional(),
  splitMemberId: z.string().optional(),
  splitRatio:    z.number().min(0).max(100).default(100),
  isRecurring:   z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

interface TransactionFormProps {
  onClose: () => void;
  transaction?: Transaction;
}

export function TransactionForm({ onClose, transaction }: TransactionFormProps) {
  const isEdit = !!transaction;
  const { mutate: create, isPending: isCreating } = useCreateTransaction();
  const { mutate: update, isPending: isUpdating } = useUpdateTransaction();
  const isPending = isCreating || isUpdating;

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  // Split state
  const [memberId,      setMemberId]      = useState<string | null>(transaction?.memberId ?? null);
  const [splitMemberId, setSplitMemberId] = useState<string | null>(transaction?.splitMemberId ?? null);
  const [splitRatio,    setSplitRatio]    = useState<number>(transaction?.splitRatio ?? 100);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: transaction
      ? {
          type:        transaction.type,
          amount:      transaction.amount,
          description: transaction.description ?? '',
          date:        format(new Date(transaction.date), 'yyyy-MM-dd'),
          categoryId:  transaction.category?.id ?? '',
          accountId:   transaction.account?.id ?? '',
          isRecurring: transaction.isRecurring,
        }
      : { type: 'EXPENSE', date: format(new Date(), 'yyyy-MM-dd'), isRecurring: false },
  });

  const selectedType = watch('type');
  const filteredCategories = (categories as Category[] | undefined)?.filter((c) => c.type === selectedType) ?? [];

  const handleMemberChange = (mId: string | null, smId: string | null, ratio: number) => {
    setMemberId(mId);
    setSplitMemberId(smId);
    setSplitRatio(ratio);
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      categoryId:    data.categoryId    || undefined,
      accountId:     data.accountId     || undefined,
      memberId:      memberId            || undefined,
      splitMemberId: splitMemberId       || undefined,
      splitRatio:    splitMemberId ? splitRatio : undefined,
    } as Record<string, unknown>;

    if (isEdit) {
      update({ id: transaction.id, data: payload }, { onSuccess: onClose });
    } else {
      create(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['EXPENSE', 'INCOME'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setValue('type', t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  selectedType === t
                    ? t === 'EXPENSE' ? 'bg-danger/20 text-danger border-danger/30' : 'bg-success/20 text-success border-success/30'
                    : 'bg-bg-elevated text-text-secondary border-border hover:border-border-strong'
                }`}>
                {t === 'EXPENSE' ? '↓ Expense' : '↑ Income'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="e.g. Groceries, Electricity bill" {...register('description')} />
          </div>

          {/* Split-aware member selector */}
          <SplitMemberSelector
            memberId={memberId}
            splitMemberId={splitMemberId}
            splitRatio={splitRatio}
            onChange={handleMemberChange}
            label={selectedType === 'INCOME' ? 'Who received this?' : 'Who paid this?'}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select defaultValue={transaction?.category?.id} onValueChange={(v) => setValue('categoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select defaultValue={transaction?.account?.id} onValueChange={(v) => setValue('accountId', v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {(accounts as Account[] | undefined)?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
