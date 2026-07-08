'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, Zap } from 'lucide-react';
import { BILL_CATEGORIES, BILL_PAYMENT_METHODS } from '@shazah/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBill, useUpdateBill } from '@/hooks/useBills';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { BILL_FREQUENCY_LABELS, billCategoryMeta } from '@/lib/constants';
import { RecurringBill } from '@/types';
import { cn } from '@/lib/utils';

const CUSTOM_CATEGORY = '__custom__';

const schema = z
  .object({
    name: z.string().min(1, 'Name required'),
    vendor: z.string().optional(),
    category: z.string().min(1, 'Category required'),
    customCategory: z.string().optional(),
    amount: z.coerce.number().positive('Amount must be positive'),
    frequency: z.enum(['ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'EVERY_2_MONTHS', 'QUARTERLY', 'EVERY_4_MONTHS', 'HALF_YEARLY', 'YEARLY', 'CUSTOM']),
    customIntervalDays: z.coerce.number().int().min(1).max(3650).optional(),
    startDate: z.string().min(1, 'Start date required'),
    endDate: z.string().optional(),
    reminderDays: z.coerce.number().int().min(0).max(60),
    autoDebit: z.boolean(),
    paymentMethod: z.string().optional(),
    accountId: z.string().optional(),
    creditCardId: z.string().optional(),
    memberId: z.string().optional(),
    url: z.string().optional(),
    notes: z.string().optional(),
    tags: z.string().optional(), // comma-separated in the form, array over the wire
  })
  .refine((d) => d.frequency !== 'CUSTOM' || (d.customIntervalDays ?? 0) >= 1, {
    message: 'Interval in days required',
    path: ['customIntervalDays'],
  })
  .refine((d) => d.category !== CUSTOM_CATEGORY || !!d.customCategory?.trim(), {
    message: 'Enter your category name',
    path: ['customCategory'],
  });

type FormData = z.infer<typeof schema>;

const REMINDER_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '7 days before' },
  { value: 14, label: '14 days before' },
];

export function BillForm({ onClose, bill }: { onClose: () => void; bill?: RecurringBill }) {
  const { mutate: createBill, isPending: isCreating } = useCreateBill();
  const { mutate: updateBill, isPending: isUpdating } = useUpdateBill();
  const { data: accounts } = useAccounts();
  const { data: cards } = useCreditCards();
  const { data: members } = useFamilyMembers();
  const isPending = isCreating || isUpdating;

  const knownCategory = !bill || (BILL_CATEGORIES as readonly string[]).includes(bill.category);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(bill && (bill.endDate || bill.url || bill.notes || bill.tags.length > 0 || bill.memberId))
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: bill
      ? {
          name: bill.name,
          vendor: bill.vendor ?? '',
          category: knownCategory ? bill.category : CUSTOM_CATEGORY,
          customCategory: knownCategory ? '' : bill.category,
          amount: bill.amount,
          frequency: bill.frequency,
          customIntervalDays: bill.customIntervalDays ?? undefined,
          startDate: bill.startDate.slice(0, 10),
          endDate: bill.endDate ? bill.endDate.slice(0, 10) : '',
          reminderDays: bill.reminderDays,
          autoDebit: bill.autoDebit,
          paymentMethod: bill.paymentMethod ?? '',
          accountId: bill.accountId ?? '',
          creditCardId: bill.creditCardId ?? '',
          memberId: bill.memberId ?? '',
          url: bill.url ?? '',
          notes: bill.notes ?? '',
          tags: bill.tags.join(', '),
        }
      : {
          category: 'Entertainment',
          frequency: 'MONTHLY',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          reminderDays: 3,
          autoDebit: false,
        },
  });

  const frequency = watch('frequency');
  const category = watch('category');
  const autoDebit = watch('autoDebit');

  function onSubmit(d: FormData) {
    const payload: Record<string, unknown> = {
      name: d.name,
      vendor: d.vendor || undefined,
      category: d.category === CUSTOM_CATEGORY ? d.customCategory!.trim() : d.category,
      amount: d.amount,
      frequency: d.frequency,
      customIntervalDays: d.frequency === 'CUSTOM' ? d.customIntervalDays : undefined,
      startDate: d.startDate,
      endDate: d.endDate || null,
      reminderDays: d.reminderDays,
      autoDebit: d.autoDebit,
      paymentMethod: d.paymentMethod || undefined,
      accountId: d.accountId || null,
      creditCardId: d.creditCardId || null,
      memberId: d.memberId || null,
      url: d.url || '',
      notes: d.notes || undefined,
      tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12) : [],
    };
    if (bill) updateBill({ id: bill.id, data: payload }, { onSuccess: onClose });
    else createBill(payload, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill ? 'Edit Bill' : 'Add Recurring Bill'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Netflix, Rent, LIC Premium" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Vendor (optional)</Label>
              <Input placeholder="e.g. Airtel, HDFC Ergo" {...register('vendor')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {BILL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{billCategoryMeta(c).icon} {c}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_CATEGORY}>✏️ Custom category…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" placeholder="499" {...register('amount')} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
          </div>

          {category === CUSTOM_CATEGORY && (
            <div className="space-y-1.5">
              <Label>Custom category name</Label>
              <Input placeholder="e.g. Pet Care" {...register('customCategory')} />
              {errors.customCategory && <p className="text-xs text-danger">{errors.customCategory.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setValue('frequency', v as FormData['frequency'])}>
                <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILL_FREQUENCY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {frequency === 'CUSTOM' ? (
              <div className="space-y-1.5">
                <Label>Repeat every (days)</Label>
                <Input type="number" min={1} placeholder="45" {...register('customIntervalDays')} />
                {errors.customIntervalDays && <p className="text-xs text-danger">{errors.customIntervalDays.message}</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Reminder</Label>
                <Select
                  value={String(watch('reminderDays'))}
                  onValueChange={(v) => setValue('reminderDays', Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Reminder" /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{frequency === 'ONE_TIME' ? 'Due Date' : 'First Due Date'}</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select
                value={watch('paymentMethod') || undefined}
                onValueChange={(v) => setValue('paymentMethod', v)}
              >
                <SelectTrigger><SelectValue placeholder="How is it paid?" /></SelectTrigger>
                <SelectContent>
                  {BILL_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Linked Bank Account</Label>
              <Select
                value={watch('accountId') || 'none'}
                onValueChange={(v) => setValue('accountId', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Linked Credit Card</Label>
              <Select
                value={watch('creditCardId') || 'none'}
                onValueChange={(v) => setValue('creditCardId', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {(cards ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cardName}{c.lastFourDigits ? ` ···· ${c.lastFourDigits}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setValue('autoDebit', !autoDebit)}
            className={cn(
              'w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors',
              autoDebit
                ? 'border-accent-violet/40 bg-accent-violet/10 text-text-primary'
                : 'border-border bg-bg-elevated text-text-secondary hover:text-text-primary'
            )}
          >
            <span className="flex items-center gap-2">
              <Zap className={cn('w-4 h-4', autoDebit ? 'text-accent-violet-light' : 'text-text-muted')} />
              Auto-debit — charged automatically
            </span>
            <span className={cn('text-xs font-semibold', autoDebit ? 'text-accent-violet-light' : 'text-text-muted')}>
              {autoDebit ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-accent-violet-light hover:underline"
          >
            {showAdvanced ? '− Hide' : '+ Show'} more options (end date, member, tags, notes)
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-xl border border-border bg-bg-elevated/50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>End Date (optional)</Label>
                  <Input type="date" {...register('endDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Family Member</Label>
                  <Select
                    value={watch('memberId') || 'none'}
                    onValueChange={(v) => setValue('memberId', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Whole family" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Whole family</SelectItem>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.emoji ?? '👤'} {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Website URL</Label>
                  <Input type="url" placeholder="https://" {...register('url')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tags (comma separated)</Label>
                  <Input placeholder="essential, shared" {...register('tags')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Anything worth remembering" {...register('notes')} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : bill ? 'Save Changes' : 'Add Bill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
