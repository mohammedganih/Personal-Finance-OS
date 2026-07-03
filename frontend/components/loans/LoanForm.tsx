'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateLoan, useUpdateLoan } from '@/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounts';
import { useInvestments } from '@/hooks/useInvestments';
import { MemberSelector } from '@/components/shared/MemberSelector';
import { Loader2 } from 'lucide-react';
import { LOAN_TYPE_LABELS, ASSET_TYPE_ICONS } from '@/lib/constants';
import { Loan, Account } from '@/types';

const schema = z.object({
  name:             z.string().min(1, 'Name required'),
  loanType:         z.enum(['HOME', 'CAR', 'PERSONAL', 'EDUCATION', 'BUSINESS', 'OTHER']),
  principal:        z.coerce.number().positive('Required'),
  interestRate:     z.coerce.number().min(0).max(100),
  emi:              z.coerce.number().positive('Required'),
  remainingBalance: z.coerce.number().min(0),
  tenureMonths:     z.coerce.number().int().positive('Required'),
  startDate:        z.string().min(1),
  lender:           z.string().optional(),
  memberId:         z.string().optional(),    // borrower
  payerMemberId:    z.string().optional(),    // who pays EMI
  bankAccountId:    z.string().optional(),    // linked account
  linkedInvestmentId: z.string().nullable().optional(),  // collateral asset (Property, Vehicle, ...)
});

type FormData = z.infer<typeof schema>;

interface LoanFormProps {
  onClose: () => void;
  loan?: Loan; // present when editing
}

export function LoanForm({ onClose, loan }: LoanFormProps) {
  const isEdit = !!loan;
  const { mutate: create, isPending: isCreating } = useCreateLoan();
  const { mutate: update, isPending: isUpdating } = useUpdateLoan();
  const isPending = isCreating || isUpdating;

  const { data: accounts } = useAccounts();
  const { data: investments } = useInvestments();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: loan
      ? {
          name: loan.name,
          loanType: loan.loanType,
          principal: loan.principal,
          interestRate: loan.interestRate,
          emi: loan.emi,
          remainingBalance: loan.remainingBalance,
          tenureMonths: loan.tenureMonths,
          startDate:     format(new Date(loan.startDate), 'yyyy-MM-dd'),
          lender:        loan.lender ?? '',
          memberId:      loan.memberId ?? undefined,
          payerMemberId: loan.payerMemberId ?? undefined,
          bankAccountId: loan.bankAccountId ?? undefined,
          linkedInvestmentId: loan.linkedInvestmentId ?? undefined,
        }
      : { startDate: format(new Date(), 'yyyy-MM-dd'), loanType: 'PERSONAL' },
  });

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
          <DialogTitle>{isEdit ? 'Edit Loan' : 'Add Loan'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loan Name</Label>
              <Input placeholder="e.g. Home Loan - SBI" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Loan Type</Label>
              <Select
                defaultValue={loan?.loanType}
                onValueChange={(v) => setValue('loanType', v as FormData['loanType'])}
              >
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Principal Amount</Label>
              <Input type="number" step="1" placeholder="500000" {...register('principal')} />
              {errors.principal && <p className="text-xs text-danger">{errors.principal.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Current Remaining Balance</Label>
              <Input type="number" step="1" placeholder="400000" {...register('remainingBalance')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>EMI / month</Label>
              <Input type="number" step="1" placeholder="15000" {...register('emi')} />
              {errors.emi && <p className="text-xs text-danger">{errors.emi.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Interest Rate %</Label>
              <Input type="number" step="0.01" placeholder="8.5" {...register('interestRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months)</Label>
              <Input type="number" step="1" placeholder="240" {...register('tenureMonths')} />
              {errors.tenureMonths && <p className="text-xs text-danger">{errors.tenureMonths.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Lender</Label>
              <Input placeholder="Bank / NBFC name" {...register('lender')} />
            </div>
          </div>

          {/* Member ownership — borrower and EMI payer can differ */}
          <div className="space-y-3 p-3 rounded-xl bg-bg-elevated border border-border">
            <MemberSelector
              label="Who borrowed this loan?"
              value={watch('memberId')}
              onChange={(id) => setValue('memberId', id ?? undefined)}
              allowJoint={false}
            />
            <MemberSelector
              label="Who pays the EMI?"
              value={watch('payerMemberId')}
              onChange={(id) => setValue('payerMemberId', id ?? undefined)}
              allowJoint={false}
            />
          </div>

          {/* Linked bank account */}
          <div className="space-y-1.5">
            <Label>Linked Bank Account (optional)</Label>
            <Select
              defaultValue={loan?.bankAccountId ?? undefined}
              onValueChange={(v) => setValue('bankAccountId', v)}
            >
              <SelectTrigger><SelectValue placeholder="Which account is this loan from?" /></SelectTrigger>
              <SelectContent>
                {(accounts as Account[] | undefined)?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked asset -- this is what makes EMI principal build equity instead of counting as an expense */}
          <div className="space-y-1.5 p-3 rounded-xl bg-bg-elevated border border-border">
            <Label>Linked Asset (optional)</Label>
            <p className="text-xs text-text-muted -mt-0.5 mb-1">
              Link this loan to a Property, Vehicle, or other asset it funded — the EMI&apos;s principal will then build that asset&apos;s equity instead of counting as a monthly expense.
            </p>
            <Select
              defaultValue={loan?.linkedInvestmentId ?? undefined}
              onValueChange={(v) => setValue('linkedInvestmentId', v === 'none' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Not linked to an asset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {investments?.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {ASSET_TYPE_ICONS[inv.assetType] ?? '💼'} {inv.assetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isEdit ? 'Save Changes' : 'Add Loan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
