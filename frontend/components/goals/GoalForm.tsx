'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addYears } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemberSelector } from '@/components/shared/MemberSelector';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateGoal, useUpdateGoal } from '@/hooks/useGoals';
import { Loader2 } from 'lucide-react';
import { GOAL_TYPE_LABELS, GOAL_TYPE_ICONS, GOAL_PRIORITY_LABELS, GOAL_RISK_LABELS } from '@/lib/constants';
import { Goal, GoalType, GoalPriority, GoalRiskLevel, Account } from '@/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  icon: z.string().optional(),
  goalType: z.enum(['FARM_HOUSE', 'EMERGENCY_FUND', 'RELOCATION', 'CAR_PURCHASE', 'RETIREMENT', 'TRAVEL', 'EDUCATION', 'CUSTOM']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  targetAmount: z.coerce.number().positive('Must be positive'),
  currentAmount: z.coerce.number().min(0).default(0),
  targetDate: z.string().min(1, 'Date required'),
  monthlyContribution: z.coerce.number().min(0).optional(),
  expectedReturnRate: z.coerce.number().min(0).max(100).optional(),
  expectedInflationRate: z.coerce.number().min(0).max(100).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface GoalFormProps {
  onClose: () => void;
  goal?: Goal;
}

export function GoalForm({ onClose, goal }: GoalFormProps) {
  const isEdit = !!goal;
  const { mutate: create, isPending: isCreating } = useCreateGoal();
  const { mutate: update, isPending: isUpdating } = useUpdateGoal();
  const isPending = isCreating || isUpdating;
  const { data: accounts } = useAccounts();

  const [memberId, setMemberId] = useState<string | null>(goal?.memberId ?? null);
  const [fundingAccountId, setFundingAccountId] = useState<string | undefined>(goal?.fundingAccountId ?? undefined);

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: goal
      ? {
          name: goal.name,
          icon: goal.icon ?? '',
          goalType: goal.goalType,
          priority: goal.priority,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: format(new Date(goal.targetDate), 'yyyy-MM-dd'),
          monthlyContribution: goal.monthlyContribution ?? undefined,
          expectedReturnRate: goal.expectedReturnRate ?? undefined,
          expectedInflationRate: goal.expectedInflationRate ?? undefined,
          riskLevel: goal.riskLevel ?? undefined,
          description: goal.description ?? '',
          notes: goal.notes ?? '',
        }
      : {
          goalType: 'CUSTOM',
          priority: 'MEDIUM',
          currentAmount: 0,
          targetDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
        },
  });

  const selectedType = watch('goalType');

  const onSubmit = (data: FormData) => {
    const payload = { ...data, memberId: memberId || undefined, fundingAccountId: fundingAccountId || undefined } as Record<string, unknown>;
    if (isEdit) {
      update({ id: goal.id, data: payload }, { onSuccess: onClose });
    } else {
      create(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Goal' : 'Create Goal'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Goal type */}
          <div className="space-y-1.5">
            <Label>Goal Type</Label>
            <Controller
              name="goalType"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.entries(GOAL_TYPE_LABELS) as [GoalType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => field.onChange(key)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center flex flex-col items-center gap-0.5',
                        field.value === key
                          ? 'bg-accent-violet/20 text-accent-violet-light border-accent-violet/40'
                          : 'bg-bg-elevated text-text-secondary border-border hover:border-border-strong'
                      )}
                    >
                      <span className="text-base leading-none">{GOAL_TYPE_ICONS[key]}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Name + icon */}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Input placeholder={GOAL_TYPE_ICONS[selectedType] ?? '🎯'} className="w-16 text-center text-xl" {...register('icon')} />
            </div>
            <div className="space-y-1.5">
              <Label>Goal Name</Label>
              <Input placeholder="e.g. Perth Relocation" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <div className="flex gap-1.5">
                  {(Object.entries(GOAL_PRIORITY_LABELS) as [GoalPriority, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => field.onChange(key)}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        field.value === key
                          ? 'bg-accent-violet/20 text-accent-violet-light border-accent-violet/40'
                          : 'bg-bg-elevated text-text-secondary border-border hover:border-border-strong'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Amount</Label>
              <Input type="number" step="1" placeholder="1000000" {...register('targetAmount')} />
              {errors.targetAmount && <p className="text-xs text-danger">{errors.targetAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Already Saved</Label>
              <Input type="number" step="1" placeholder="0" {...register('currentAmount')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Date</Label>
              <Input type="date" {...register('targetDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Contribution (optional)</Label>
              <Input type="number" step="500" placeholder="10000" {...register('monthlyContribution')} />
            </div>
          </div>

          {/* Planning assumptions */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Expected Return %</Label>
              <Input type="number" step="0.1" placeholder="8" {...register('expectedReturnRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Inflation %</Label>
              <Input type="number" step="0.1" placeholder="6" {...register('expectedInflationRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Risk Level</Label>
              <Controller
                name="riskLevel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(GOAL_RISK_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Ownership */}
          <MemberSelector value={memberId} onChange={setMemberId} label="Whose goal is this?" />

          {/* Funding source */}
          <div className="space-y-1.5">
            <Label>Funding Source (optional)</Label>
            <Select value={fundingAccountId} onValueChange={setFundingAccountId}>
              <SelectTrigger><SelectValue placeholder="Which account funds this goal?" /></SelectTrigger>
              <SelectContent>
                {(accounts as Account[] | undefined)?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="What is this goal for?" {...register('description')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input placeholder="Any additional context..." {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
