'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useDebtStrategy, usePrepaymentCalculator } from '@/hooks/useDebtIntelligence';
import { formatCurrency } from '@/lib/format';

export function PrepaymentCalculator() {
  const { data: strategy, isLoading } = useDebtStrategy(5000);
  const [debtId, setDebtId] = useState<string>('');
  const [lumpSum, setLumpSum] = useState('50000');
  const { mutate, data: result, isPending, reset } = usePrepaymentCalculator();

  // Default to the highest-interest debt (the mathematically optimal
  // target) so this reads as "if you had a lump sum, here's the plan" by
  // default, rather than an empty form waiting for input.
  useEffect(() => {
    if (!debtId && strategy?.avalancheOrder?.length) {
      setDebtId(strategy.avalancheOrder[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.avalancheOrder]);

  if (isLoading) return <div className="glass-card rounded-2xl h-56 shimmer" />;
  if (!strategy?.debts?.length) return null;

  const amount = Math.max(0, Number(lumpSum) || 0);
  const selected = strategy.debts.find((d) => d.id === debtId);

  function handleCalculate() {
    if (!debtId || amount <= 0) return;
    mutate({ debtId, lumpSum: amount });
  }

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Prepayment Calculator</h3>
      </div>
      <p className="text-xs text-text-secondary">
        Expecting a bonus, payout, or maturity? See what applying it to a debt today would save — defaults to your highest-interest debt.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-text-secondary">Debt</Label>
          <Select value={debtId} onValueChange={(v) => { setDebtId(v); reset(); }}>
            <SelectTrigger><SelectValue placeholder="Choose a debt" /></SelectTrigger>
            <SelectContent>
              {strategy.debts.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name} · {d.interestRate}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-text-secondary">Lump sum</Label>
          <Input
            type="number" step="1000" value={lumpSum}
            onChange={(e) => { setLumpSum(e.target.value); reset(); }}
            className="w-32"
          />
        </div>
        <Button size="default" disabled={!debtId || amount <= 0 || isPending} onClick={handleCalculate}>
          Calculate
        </Button>
      </div>

      {result && selected && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-bg-elevated rounded-xl p-3">
            <p className="text-xs text-text-muted">Payoff time</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">
              {result.baselineMonths} → <span className="text-success">{result.newMonths} months</span>
            </p>
            {result.monthsSaved > 0 && <p className="text-xs text-success mt-0.5">{result.monthsSaved} months sooner</p>}
          </div>
          <div className="bg-bg-elevated rounded-xl p-3">
            <p className="text-xs text-text-muted">Interest saved</p>
            <p className="text-sm font-semibold text-success mt-0.5">{formatCurrency(result.interestSaved, 'INR', true)}</p>
            <p className="text-xs text-text-muted mt-0.5">on {selected.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
