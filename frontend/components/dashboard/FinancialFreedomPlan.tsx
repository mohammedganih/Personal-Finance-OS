'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Landmark, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useInvestments } from '@/hooks/useInvestments';
import { useLoans } from '@/hooks/useLoans';
import { useGoals } from '@/hooks/useGoals';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

const DEFAULT_INCOME = 200_000;
const DEFAULT_RETURN = 12;
const DEFAULT_INFLATION = 6;
const DEFAULT_WITHDRAWAL = 3.5;

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function FinancialFreedomPlan() {
  const { data: investments } = useInvestments();
  const { data: loans } = useLoans();
  const { data: goals } = useGoals();
  const { data: overview } = useDashboardOverview();
  const [retirementAge, setRetirementAge] = useState(40);
  const [incomeGrowth, setIncomeGrowth] = useState(10);
  const [returnRate, setReturnRate] = useState(DEFAULT_RETURN);
  const [livingCost, setLivingCost] = useState<number | null>(null);

  const model = useMemo(() => {
    const currentAge = 28;
    const horizonMonths = Math.max(12, (retirementAge - currentAge) * 12);
    const monthlyLivingCost = livingCost ?? Math.max(40_000, overview?.otherExpenses ?? 0);
    const financialAssets = (investments ?? [])
      .filter((investment) => investment.assetType !== 'REAL_ESTATE' && investment.assetType !== 'VEHICLE')
      .reduce((sum, investment) => sum + Number(investment.quantity) * Number(investment.currentPrice), 0);
    const activeLoans = (loans ?? []).filter((loan) => loan.isActive);
    const goalCostAtTarget = (goals ?? [])
      .filter((goal) => goal.status === 'ACTIVE' && !goal.isCompleted)
      .reduce((sum, goal) => {
        const years = Math.max(0, (new Date(goal.targetDate).getTime() - Date.now()) / 31_557_600_000);
        return sum + Number(goal.targetAmount) * Math.pow(1 + DEFAULT_INFLATION / 100, years);
      }, 0);

    let portfolio = financialAssets;
    let monthlyIncome = DEFAULT_INCOME;
    let monthlyExpense = monthlyLivingCost;
    const monthlyReturn = Math.pow(1 + returnRate / 100, 1 / 12) - 1;
    const loanMonths = new Map(activeLoans.map((loan) => [loan.id, Math.max(1, Math.ceil(Number(loan.remainingBalance) / Math.max(1, Number(loan.emi))))]));
    let projectedContribution = 0;

    for (let month = 0; month < horizonMonths; month += 1) {
      if (month > 0 && month % 12 === 0) {
        monthlyIncome *= 1 + incomeGrowth / 100;
        monthlyExpense *= 1 + DEFAULT_INFLATION / 100;
      }
      const emi = activeLoans.reduce((sum, loan) => sum + (month < (loanMonths.get(loan.id) ?? 0) ? Number(loan.emi) : 0), 0);
      projectedContribution = Math.max(0, monthlyIncome - monthlyExpense - emi);
      portfolio = portfolio * (1 + monthlyReturn) + projectedContribution;
    }

    const retirementMonthlyExpense = monthlyLivingCost * Math.pow(1 + DEFAULT_INFLATION / 100, horizonMonths / 12);
    const freedomCorpus = (retirementMonthlyExpense * 12) / (DEFAULT_WITHDRAWAL / 100);
    const totalTarget = freedomCorpus + goalCostAtTarget;
    const currentEmi = activeLoans.reduce((sum, loan) => sum + Number(loan.emi), 0);
    const currentDebt = activeLoans.reduce((sum, loan) => sum + Number(loan.remainingBalance), 0);

    return { financialAssets, projectedContribution, portfolio, freedomCorpus, goalCostAtTarget, totalTarget, currentEmi, currentDebt, monthlyLivingCost, horizonMonths };
  }, [investments, loans, goals, overview?.otherExpenses, retirementAge, incomeGrowth, returnRate, livingCost]);

  const fundedPercent = model.totalTarget > 0 ? Math.min(100, (model.portfolio / model.totalTarget) * 100) : 0;
  const gap = Math.max(0, model.totalTarget - model.portfolio);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent-violet/30 bg-gradient-to-br from-accent-violet/20 via-bg-surface to-bg-surface p-5 sm:p-6">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-violet/20 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-accent-violet-light"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Your freedom plan</span></div>
            <h2 className="mt-1 text-xl font-bold text-text-primary">A household timeline, not isolated trackers.</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">Projects investable wealth only—your home is excluded from retirement funding unless you choose to sell it.</p>
          </div>
          <div className="rounded-2xl bg-bg/60 px-4 py-3 text-right backdrop-blur">
            <p className="text-xs text-text-muted">Target age</p>
            <p className="text-2xl font-bold text-text-primary">{retirementAge}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={TrendingUp} label="Investable assets" value={formatCurrency(model.financialAssets, 'INR', true)} />
          <Metric icon={Landmark} label="Active debt" value={formatCurrency(model.currentDebt, 'INR', true)} detail={`${formatCurrency(model.currentEmi)}/mo EMI`} />
          <Metric icon={ShieldCheck} label="Freedom corpus" value={formatCurrency(model.freedomCorpus, 'INR', true)} detail={`at ${DEFAULT_WITHDRAWAL}% withdrawal`} />
          <Metric icon={Sparkles} label={`Projected at ${retirementAge}`} value={formatCurrency(model.portfolio, 'INR', true)} detail={`${formatCurrency(model.projectedContribution)}/mo invested initially`} />
        </div>

        <div className="grid gap-5 rounded-2xl border border-border bg-bg/60 p-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-text-primary">Readiness at age {retirementAge}</p><p className="text-xs text-text-muted">Includes {formatCurrency(model.goalCostAtTarget, 'INR', true)} for active goals at their target dates.</p></div><span className="text-lg font-bold text-accent-violet-light">{fundedPercent.toFixed(0)}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${fundedPercent}%` }} /></div>
            <p className="text-sm text-text-secondary">{gap > 0 ? <><span className="font-semibold text-warning">{formatCurrency(gap, 'INR', true)} still to fund.</span> The fastest lever is directing every EMI that ends into diversified long-term investments.</> : <><span className="font-semibold text-success">This plan covers the modeled target.</span> Protect it with a dedicated emergency fund before increasing risk.</>}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Retirement age" value={retirementAge} onChange={(value) => setRetirementAge(Math.max(35, Math.min(60, numberValue(value, 40))))} suffix="years" />
            <Field label="Income growth" value={incomeGrowth} onChange={(value) => setIncomeGrowth(Math.min(20, numberValue(value, 10)))} suffix="% / yr" />
            <Field label="Expected return" value={returnRate} onChange={(value) => setReturnRate(Math.min(18, numberValue(value, DEFAULT_RETURN)))} suffix="% / yr" />
            <Field label="Living cost today" value={livingCost ?? model.monthlyLivingCost} onChange={(value) => setLivingCost(numberValue(value, model.monthlyLivingCost))} suffix="/ month" />
          </div>
        </div>
        <p className="flex items-center gap-1 text-xs text-text-muted">Assumes ₹2.0L combined monthly income, {DEFAULT_INFLATION}% inflation and {DEFAULT_WITHDRAWAL}% withdrawal. This is a planning estimate, not an investment-return promise. <ArrowRight className="h-3 w-3" /></p>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof TrendingUp; label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-border bg-bg/65 p-4"><div className="flex items-center gap-2 text-text-muted"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div><p className="mt-2 text-lg font-bold text-text-primary">{value}</p>{detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}</div>;
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: string) => void; suffix: string }) {
  return <label className="block"><span className="text-xs text-text-muted">{label}</span><div className="mt-1 flex items-center gap-1 rounded-xl border border-border bg-bg-elevated px-2"><input aria-label={label} className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold text-text-primary outline-none" type="number" min="0" value={Math.round(value)} onChange={(event) => onChange(event.target.value)} /><span className="whitespace-nowrap text-[10px] text-text-muted">{suffix}</span></div></label>;
}
