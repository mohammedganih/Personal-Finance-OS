'use client';

import { useState } from 'react';
import { Plus, TrendingUp, Pencil, Trash2, Wallet, IndianRupee, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/StatCard';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePortfolioSummary, useDeleteInvestment, usePayInvestment } from '@/hooks/useInvestments';
import { useAnnualizedReturns } from '@/hooks/useInvestmentIntelligence';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from '@/lib/constants';
import { InvestmentForm } from '@/components/investments/InvestmentForm';
import { InvestmentDetailDialog } from '@/components/investments/InvestmentDetailDialog';
import { PortfolioTrendChart } from '@/components/investments/PortfolioTrendChart';
import { AnnualizedReturns } from '@/components/investments/AnnualizedReturns';
import { AllocationDonut } from '@/components/investments/AllocationDonut';
import { HealthScoreCard } from '@/components/investments/HealthScoreCard';
import { AIInsightStack } from '@/components/investments/AIInsightStack';
import { MaturityRadar } from '@/components/investments/MaturityRadar';
import { InvestmentCalendar } from '@/components/investments/InvestmentCalendar';
import { Investment, InvestmentWithPnl, AssetType } from '@/types';
import { cn } from '@/lib/utils';
import { MemberBadge } from '@/components/shared/MemberSelector';

// Types that have a recurring monthly payment
const INSTALLMENT_TYPES = new Set<AssetType>(['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME']);

// Button label per type
function payLabel(assetType: AssetType, isInstallment: boolean): string {
  if (assetType === 'SIP')               return '✓ Pay SIP';
  if (assetType === 'RECURRING_DEPOSIT') return '✓ Pay RD';
  if (assetType === 'GOLD_SCHEME')       return '✓ Pay Deposit';
  return '✓ Log Expense';
}

// ─── Per-type secondary info line ─────────────────────────────────────────────
// Kept to the 2 facts someone actually scans a list for (what it is, what's
// committed monthly). Folio numbers, exchange, platform, interest rate, and
// maturity details still live in the detail dialog one click away -- see
// InvestmentDetailDialog -- so nothing is lost, just not crammed into every row.
function InvestmentSubInfo({ inv }: { inv: InvestmentWithPnl }) {
  const { assetType } = inv;

  if (assetType === 'SIP' || assetType === 'MUTUAL_FUND') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>{inv.quantity.toFixed(3)} units @ NAV ₹{inv.currentPrice.toFixed(2)}</span>
        {assetType === 'SIP' && inv.monthlyAmount && (
          <span className="text-accent-violet-light">· ₹{inv.monthlyAmount.toLocaleString('en-IN')}/mo SIP</span>
        )}
      </p>
    );
  }

  if (assetType === 'RECURRING_DEPOSIT') {
    const installmentsPaid = inv.quantity;
    const deposited = (inv.monthlyAmount ?? 0) * installmentsPaid;
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>₹{(inv.monthlyAmount ?? 0).toLocaleString('en-IN')}/mo · {installmentsPaid} installments</span>
        <span>· ₹{deposited.toLocaleString('en-IN')} deposited</span>
      </p>
    );
  }

  if (assetType === 'FIXED_DEPOSIT') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>Principal ₹{inv.buyPrice.toLocaleString('en-IN')}</span>
        {inv.maturityDate && <span>· Matures {formatDate(inv.maturityDate, 'MMM yyyy')}</span>}
      </p>
    );
  }

  if (assetType === 'GOLD') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>{inv.quantity}g · Now ₹{inv.currentPrice.toLocaleString('en-IN')}/g</span>
      </p>
    );
  }

  if (assetType === 'GOLD_SCHEME') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        {inv.monthlyAmount && <span>₹{inv.monthlyAmount.toLocaleString('en-IN')}/mo ·</span>}
        <span>{inv.quantity}g accumulated</span>
      </p>
    );
  }

  if (assetType === 'REAL_ESTATE') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>Purchased {formatDate(inv.purchaseDate)}</span>
      </p>
    );
  }

  return (
    <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
      {inv.quantity > 0 && <span>{inv.quantity} units</span>}
      {inv.ticker && <span>· {inv.ticker}</span>}
    </p>
  );
}

// ─── Current value display per type ───────────────────────────────────────────
function currentValueForType(inv: InvestmentWithPnl): number {
  if (inv.assetType === 'FIXED_DEPOSIT') return inv.maturityAmount ?? inv.buyPrice;
  if (inv.assetType === 'RECURRING_DEPOSIT') {
    // quantity = installments paid (user-entered), not derived from dates
    return (inv.monthlyAmount ?? 0) * inv.quantity;
  }
  if (inv.assetType === 'GOLD_SCHEME') return inv.quantity * inv.currentPrice;
  // REAL_ESTATE/VEHICLE (and everything else): inv.currentValue is the
  // backend-computed figure, already scaled by ownershipPercent for
  // collateral assets -- inv.currentPrice alone would be the FULL market
  // value, ignoring what share of it the household actually owns.
  return inv.currentValue;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [viewingInvestment, setViewingInvestment] = useState<InvestmentWithPnl | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const { data: summary, isLoading } = usePortfolioSummary();
  const { data: returns } = useAnnualizedReturns();
  const { mutate: deleteInvestment } = useDeleteInvestment();
  const { mutate: payInvestment, isPending: isPaying } = usePayInvestment();

  const portfolio = summary?.portfolio ?? [];

  const openAdd  = () => { setEditingInvestment(null); setShowForm(true); };
  const openEdit = (inv: Investment) => { setEditingInvestment(inv); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingInvestment(null); };

  // The allocation donut and the AI advisor's "review allocation" link both
  // jump here -- the donut to the matching type group, the advisor to the
  // section in general -- so the chart is a navigation aid, not decoration.
  const scrollToHoldingType = (type: string) => {
    setHighlightedType(type);
    document.getElementById(`holdings-${type}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setHighlightedType((cur) => (cur === type ? null : cur)), 1600);
  };
  const scrollToHoldings = () => {
    document.getElementById('investment-holdings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Group by type
  const grouped = portfolio.reduce<Record<string, InvestmentWithPnl[]>>((acc, inv) => {
    (acc[inv.assetType] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <PageShell>
      <PageHeader
        title="Investments"
        subtitle={`${portfolio.length} holdings`}
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Add Holding
          </Button>
        }
      />

      {/* Growth first: "how is my wealth growing" is the question this page
          answers, and the chart + XIRR-carrying stat below confirm it before
          anything about individual holdings. */}
      <PortfolioTrendChart />

      {/* Summary strip -- Current Value carries the real annualized return
          (XIRR) as its trend, not a blended flat P&L% that can mislead when
          the portfolio mixes a guaranteed FD with a brand-new SIP. Uses the
          same StatCard the Dashboard already uses, for visual consistency. */}
      {portfolio.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Invested"
            value={summary?.totalInvested ?? 0}
            icon={Wallet}
            iconColor="bg-info/15 text-info"
          />
          <StatCard
            title="Current Value"
            value={summary?.totalCurrent ?? 0}
            change={returns?.overall !== null && returns?.overall !== undefined ? returns.overall * 100 : undefined}
            changeLabel="annualized"
            icon={TrendingUp}
            iconColor="bg-accent-violet/15 text-accent-violet-light"
          />
          <StatCard
            title="Total P&L"
            value={summary?.totalPnl ?? 0}
            change={summary?.totalInvested ? (summary.totalPnl / summary.totalInvested) * 100 : undefined}
            icon={IndianRupee}
            iconColor="bg-success/15 text-success"
            colorizePositive
          />
          <StatCard
            title="Monthly Investment"
            value={portfolio.reduce((s, inv) => s + (inv.monthlyAmount ?? 0), 0)}
            icon={Repeat}
            iconColor="bg-warning/15 text-warning"
          />
        </div>
      )}

      {portfolio.length === 0 && !isLoading ? (
        <EmptyState
          icon={TrendingUp}
          title="No investments tracked"
          description="Once you add a holding, this is where you'll watch it grow"
          action={{ label: 'Add Holding', onClick: openAdd }}
        />
      ) : (
        <>
          {/* Allocation + health/risk, side by side -- "is it shaped right"
              right after the growth story confirms "am I growing". */}
          <div className="grid lg:grid-cols-2 gap-4">
            <AllocationDonut onSelectType={scrollToHoldingType} />
            <HealthScoreCard />
          </div>

          <AIInsightStack onReviewAllocation={scrollToHoldings} />

          {/* Holdings grouped by type */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-16 shimmer" />
              ))}
            </div>
          ) : (
            <div id="investment-holdings" className="space-y-6">
              {Object.entries(grouped).map(([type, holdings]) => (
                <div key={type}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{ASSET_TYPE_ICONS[type] ?? '💼'}</span>
                    <h3 className="text-sm font-semibold text-text-secondary">{ASSET_TYPE_LABELS[type] ?? type}</h3>
                    <span className="text-xs text-text-muted">({holdings.length})</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-text-secondary font-mono">
                      {formatCurrency(holdings.reduce((s, h) => s + currentValueForType(h), 0), 'INR', true)}
                    </span>
                  </div>

                  {/* Holdings table */}
                  <div
                    id={`holdings-${type}`}
                    className={cn(
                      'glass-card rounded-2xl overflow-hidden transition-shadow duration-300',
                      highlightedType === type && 'ring-2 ring-accent-violet/60'
                    )}
                  >
                    <div className="divide-y divide-border">
                      {holdings.map((inv) => {
                        const curVal = currentValueForType(inv);
                        const showPnl = !['FIXED_DEPOSIT', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'].includes(inv.assetType);

                        return (
                          <div key={inv.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-bg-elevated/50 transition-colors group">
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center text-lg shrink-0">
                              {ASSET_TYPE_ICONS[inv.assetType] ?? '💼'}
                            </div>

                            {/* Name + sub info -- click to drill into full detail */}
                            <button
                              type="button"
                              onClick={() => setViewingInvestment(inv)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate hover:text-accent-violet-light transition-colors">{inv.assetName}</p>
                                <MemberBadge
                                  member={inv.member ?? null}
                                  splitMember={inv.splitMember ?? null}
                                  splitRatio={inv.splitRatio}
                                />
                              </div>
                              <InvestmentSubInfo inv={inv} />
                            </button>

                            {/* P&L */}
                            {showPnl && (
                              <div className="text-right hidden sm:block">
                                <p className={cn('text-xs font-medium font-mono',
                                  inv.pnl >= 0 ? 'text-success' : 'text-danger')}>
                                  {inv.pnl >= 0 ? '+' : ''}{formatCurrency(inv.pnl, 'INR', true)}
                                </p>
                                <p className={cn('text-xs', inv.pnlPercent >= 0 ? 'text-success' : 'text-danger')}>
                                  {formatPercent(inv.pnlPercent)}
                                </p>
                              </div>
                            )}

                            {/* Current value */}
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold font-mono text-text-primary">
                                {formatCurrency(curVal, 'INR', true)}
                              </p>
                              <p className="text-xs text-text-muted">
                                {formatDate(inv.purchaseDate, 'dd MMM yy')}
                              </p>
                            </div>

                            {/* Actions */}
                            {/* Always visible below sm: -- hover-reveal has no
                                equivalent on touch devices, so there'd be no
                                way to reach these buttons on a phone otherwise. */}
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {/* Pay / Log expense button */}
                              {payingId === inv.id ? (
                                <div className="flex items-center gap-1 mr-1">
                                  <span className="text-xs text-text-secondary whitespace-nowrap">
                                    Log ₹{(
                                      INSTALLMENT_TYPES.has(inv.assetType)
                                        ? (inv.monthlyAmount ?? 0)
                                        : inv.quantity * inv.buyPrice
                                    ).toLocaleString('en-IN')}?
                                  </span>
                                  <button
                                    onClick={() => { payInvestment({ id: inv.id }); setPayingId(null); }}
                                    disabled={isPaying}
                                    className="px-2 py-1 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors"
                                  >
                                    {isPaying ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => setPayingId(null)}
                                    className="px-1.5 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs"
                                  >✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPayingId(inv.id)}
                                  className="px-2 py-1 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors mr-1 whitespace-nowrap"
                                >
                                  {payLabel(inv.assetType, INSTALLMENT_TYPES.has(inv.assetType))}
                                </button>
                              )}

                              <button
                                aria-label={`Edit ${inv.assetName}`}
                                onClick={() => openEdit(inv as Investment)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                aria-label={`Delete ${inv.assetName}`}
                                onClick={() => deleteInvestment(inv.id)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Performance analysis -- per-holding XIRR and the maturity
              timeline, for comparing holdings against each other rather
              than the "am I growing / is it shaped right" questions the
              page opens with. */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-3">Performance Analysis</p>
            <div className="space-y-4">
              <AnnualizedReturns />
              <MaturityRadar />
              <InvestmentCalendar />
            </div>
          </div>
        </>
      )}

      {showForm && (
        <InvestmentForm
          onClose={closeForm}
          investment={editingInvestment ?? undefined}
        />
      )}

      {viewingInvestment && (
        <InvestmentDetailDialog
          investment={viewingInvestment}
          onClose={() => setViewingInvestment(null)}
          onEdit={() => { const inv = viewingInvestment; setViewingInvestment(null); openEdit(inv as Investment); }}
          onDelete={() => { deleteInvestment(viewingInvestment.id); setViewingInvestment(null); }}
        />
      )}
    </PageShell>
  );
}
