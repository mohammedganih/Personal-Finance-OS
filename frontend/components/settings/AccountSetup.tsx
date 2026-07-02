'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAccounts } from '@/hooks/useAccounts';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MemberSelector } from '@/components/shared/MemberSelector';
import { Account } from '@/types';
import { formatCurrency } from '@/lib/format';
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  name:     z.string().min(1, 'Name required'),
  type:     z.enum(['SAVINGS', 'CHECKING', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'OTHER']),
  balance:  z.coerce.number().default(0),
  memberId: z.string().optional(),
  color:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!account;

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast({ title: 'Account added' }); onClose(); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });
  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/accounts/${account!.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast({ title: 'Account updated' }); onClose(); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });
  const isPending = createMut.isPending || updateMut.isPending;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: account
      ? { name: account.name, type: account.type, balance: account.balance, memberId: account.memberId ?? undefined }
      : { type: 'SAVINGS', balance: 0 },
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) updateMut.mutate(data as Record<string, unknown>);
    else createMut.mutate(data as Record<string, unknown>);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Account' : 'Add Bank Account'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Account Name</Label>
            <Input placeholder="e.g. SBI Savings, HDFC Salary" {...register('name')} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select defaultValue={account?.type} onValueChange={(v) => setValue('type', v as FormData['type'])}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current Balance (₹)</Label>
              <Input type="number" step="1" placeholder="0" {...register('balance')} />
            </div>
          </div>

          <MemberSelector
            label="Whose account?"
            value={watch('memberId')}
            onChange={(id) => setValue('memberId', id ?? undefined)}
            allowJoint={true}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountSetup() {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const { data: accounts, isLoading } = useAccounts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast({ title: 'Account removed' }); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  const accs = (accounts as Account[] | undefined) ?? [];

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Bank Accounts</h3>
        </div>
        <Button size="sm" onClick={() => { setEditingAccount(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <p className="text-xs text-text-secondary">
        Add accounts for each family member. These will appear as options when logging transactions, investments, and loans.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 glass-card rounded-xl shimmer" />)}
        </div>
      ) : accs.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-xl">
          <Wallet className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted mb-1">No accounts yet</p>
          <p className="text-xs text-text-muted mb-3">Add your bank accounts, wallets, and credit cards</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Account
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {accs.map((acc) => (
            <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated group">
              <div className="w-9 h-9 rounded-xl bg-accent-violet/10 flex items-center justify-center text-sm shrink-0">
                🏦
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{acc.name}</p>
                <p className="text-xs text-text-muted">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
              </div>
              <p className="text-sm font-semibold font-mono text-text-primary shrink-0">
                {formatCurrency(acc.balance, 'INR', true)}
              </p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingAccount(acc); setShowForm(true); }} className="p-1.5 rounded text-text-muted hover:text-accent-violet-light transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteMut.mutate(acc.id)} className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <AccountForm account={editingAccount ?? undefined} onClose={() => { setShowForm(false); setEditingAccount(null); }} />}
    </div>
  );
}
