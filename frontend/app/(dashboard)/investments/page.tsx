'use client';

import { useState } from 'react';
import { Plus, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePortfolioSummary, useDeleteInvestment, usePayInvestment } from '@/hooks/useInvestments';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from '@/lib/constants';
import { InvestmentForm } from '@/components/investments/InvestmentForm';
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
// Platform badge shown on every holding
function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return (
    <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-violet/10 text-accent-violet-light">
      {platform}
    </span>
  );
}

function InvestmentSubInfo({ inv }: { inv: InvestmentWithPnl }) {
  const { assetType } = inv;

  if (assetType === 'SIP' || assetType === 'MUTUAL_FUND') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        {inv.fundCategory && <span>{inv.fundCategory} ·</span>}
        <span>{inv.quantity.toFixed(3)} units @ NAV ₹{inv.currentPrice.toFixed(2)}</span>
        {inv.folioNumber && <span>· Folio: {inv.folioNumber}</span>}
        {assetType === 'SIP' && inv.monthlyAmount && (
          <span className="text-accent-violet-light">· ₹{inv.monthlyAmount.toLocaleString('en-IN')}/mo SIP</span>
        )}
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  if (assetType === 'RECURRING_DEPOSIT') {
    const installmentsPaid = inv.quantity;
    const deposited = (inv.monthlyAmount ?? 0) * installmentsPaid;
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>₹{(inv.monthlyAmount ?? 0).toLocaleString('en-IN')}/mo · {installmentsPaid} installments · ₹{deposited.toLocaleString('en-IN')} deposited</span>
        {inv.interestRate && <span>· {inv.interestRate}% p.a.</span>}
        {inv.maturityDate && <span>· Matures {formatDate(inv.maturityDate, 'MMM yyyy')}</span>}
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  if (assetType === 'FIXED_DEPOSIT') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>Principal ₹{inv.buyPrice.toLocaleString('en-IN')}</span>
        {inv.interestRate && <span>· {inv.interestRate}% p.a.</span>}
        {inv.maturityDate && <span>· Matures {formatDate(inv.maturityDate, 'MMM yyyy')}</span>}
        {inv.maturityAmount && (
          <span className="text-success">· Maturity ₹{inv.maturityAmount.toLocaleString('en-IN')}</span>
        )}
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  if (assetType === 'GOLD') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>{inv.quantity}g · Buy ₹{inv.buyPrice.toLocaleString('en-IN')}/g · Now ₹{inv.currentPrice.toLocaleString('en-IN')}/g</span>
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  if (assetType === 'GOLD_SCHEME') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        {inv.monthlyAmount && <span>₹{inv.monthlyAmount.toLocaleString('en-IN')}/mo ·</span>}
        <span>{inv.quantity}g accumulated · ₹{inv.currentPrice.toLocaleString('en-IN')}/g</span>
        {inv.maturityDate && <span>· Matures {formatDate(inv.maturityDate, 'MMM yyyy')}</span>}
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  if (assetType === 'REAL_ESTATE') {
    return (
      <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
        <span>Purchased {formatDate(inv.purchaseDate)} · Current value ₹{inv.currentPrice.toLocaleString('en-IN')}</span>
        <PlatformBadge platform={inv.platform} />
      </p>
    );
  }

  return (
    <p className="text-xs text-text-muted flex items-center flex-wrap gap-x-1">
      {inv.quantity > 0 && <span>{inv.quantity} units</span>}
      {inv.ticker && <span>· {inv.ticker}</span>}
      {inv.exchange && <span>· {inv.exchange}</span>}
      <PlatformBadge platform={inv.platform} />
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
  if (inv.assetType === 'REAL_ESTATE') return inv.currentPrice;
  return inv.currentValue;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { data: summary, isLoading } = usePortfolioSummary();
  const { mutate: deleteInvestment } = useDeleteInvestment();
  const { mutate: payInvestment, isPending: isPaying } = usePayInvestment();

  const portfolio = summary?.portfolio ?? [];

  const openAdd  = () => { setEditingInvestment(null); setShowForm(true); };
  const openEdit = (inv: Investment) => { setEditingInvestment(inv); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingInvestment(null); };

  // Group by type
  const grouped = portfolio.reduce<Record<string, InvestmentWithPnl[]>>((acc, inv) => {
    (acc[inv.assetType] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Investments</h2>
          <p className="text-sm text-text-secondary mt-0.5">{portfolio.length} holdings</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Holding
        </Button>
      </div>

      {/* Summary strip */}
      {portfolio.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Invested',     value: summary?.totalInvested ?? 0,  color: 'text-text-primary' },
            { label: 'Current Value', value: summary?.totalCurrent ?? 0,  color: 'text-text-primary' },
            { label: 'Total P&L',    value: summary?.totalPnl ?? 0,       color: (summary?.totalPnl ?? 0) >= 0 ? 'text-success' : 'text-danger', prefix: (summary?.totalPnl ?? 0) >= 0 ? '+' : '' },
            {
              label: 'Overall Return',
              value: summary?.totalInvested ? ((summary.totalPnl / summary.totalInvested) * 100) : 0,
              color: (summary?.totalPnl ?? 0) >= 0 ? 'text-success' : 'text-danger',
              isPercent: true,
            },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <p className="text-xs text-text-secondary">{s.label}</p>
              <p className={cn('text-xl font-bold mt-1', s.color)}>
                {s.isPercent
                  ? `${(s.value as number) >= 0 ? '+' : ''}${(s.value as number).toFixed(2)}%`
                  : `${s.prefix ?? ''}${formatCurrency(s.value as number, 'INR', true)}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Holdings grouped by type */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-16 shimmer" />
          ))}
        </div>
      ) : portfolio.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investments tracked"
          description="Add stocks, SIPs, FDs, gold, or any other holding"
          action={{ label: 'Add Holding', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-6">
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
              <div className="glass-card rounded-2xl overflow-hidden">
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

                        {/* Name + sub info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{inv.assetName}</p>
                            <MemberBadge
                              member={inv.member ?? null}
                              splitMember={inv.splitMember ?? null}
                              splitRatio={inv.splitRatio}
                            />
                          </div>
                          <InvestmentSubInfo inv={inv} />
                        </div>

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
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {showForm && (
        <InvestmentForm
          onClose={closeForm}
          investment={editingInvestment ?? undefined}
        />
      )}
    </div>
  );
}
