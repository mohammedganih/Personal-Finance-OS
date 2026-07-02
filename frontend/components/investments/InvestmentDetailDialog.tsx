'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatPercent, getDaysUntil } from '@/lib/format';
import { ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from '@/lib/constants';
import { useAnnualizedReturns, useInvestmentCalendar } from '@/hooks/useInvestmentIntelligence';
import { MemberBadge } from '@/components/shared/MemberSelector';
import { InvestmentWithPnl } from '@/types';
import { cn } from '@/lib/utils';

function xirrColor(xirr: number | null): string {
  if (xirr === null) return 'text-text-muted';
  return xirr >= 0 ? 'text-success' : 'text-danger';
}

function formatXirr(xirr: number | null): string {
  if (xirr === null) return 'N/A';
  return `${xirr >= 0 ? '+' : ''}${(xirr * 100).toFixed(1)}%`;
}

interface InvestmentDetailDialogProps {
  investment: InvestmentWithPnl;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function InvestmentDetailDialog({ investment, onClose, onEdit, onDelete }: InvestmentDetailDialogProps) {
  const { data: returns } = useAnnualizedReturns();
  const { data: calendar } = useInvestmentCalendar(3);

  const xirr = returns?.byHolding.find((h) => h.investmentId === investment.id)?.xirr ?? null;
  const upcoming = (calendar ?? []).filter((e) => e.investmentId === investment.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{ASSET_TYPE_ICONS[investment.assetType] ?? '💼'}</span>
            <div>
              <DialogTitle>{investment.assetName}</DialogTitle>
              <p className="text-xs text-text-secondary mt-0.5">{ASSET_TYPE_LABELS[investment.assetType] ?? investment.assetType}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-elevated rounded-xl p-3">
              <p className="text-xs text-text-muted">Invested</p>
              <p className="text-sm font-semibold font-mono text-text-primary mt-0.5">{formatCurrency(investment.investedValue, 'INR', true)}</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3">
              <p className="text-xs text-text-muted">Current Value</p>
              <p className="text-sm font-semibold font-mono text-text-primary mt-0.5">{formatCurrency(investment.currentValue, 'INR', true)}</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3">
              <p className="text-xs text-text-muted">P&L</p>
              <p className={cn('text-sm font-semibold font-mono mt-0.5', investment.pnl >= 0 ? 'text-success' : 'text-danger')}>
                {investment.pnl >= 0 ? '+' : ''}{formatCurrency(investment.pnl, 'INR', true)} ({formatPercent(investment.pnlPercent)})
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3">
              <p className="text-xs text-text-muted">Annualized Return (XIRR)</p>
              <p className={cn('text-sm font-semibold font-mono mt-0.5', xirrColor(xirr))}>{formatXirr(xirr)}</p>
            </div>
          </div>

          {/* Ownership */}
          {investment.member && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-secondary">Owned by</p>
              <MemberBadge member={investment.member} splitMember={investment.splitMember} splitRatio={investment.splitRatio} />
            </div>
          )}

          {/* Type-specific facts */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-text-muted">Purchase / Start Date</p>
              <p className="text-text-primary font-medium mt-0.5">{formatDate(investment.purchaseDate)}</p>
            </div>
            {investment.interestRate !== null && (
              <div>
                <p className="text-text-muted">Interest Rate</p>
                <p className="text-text-primary font-medium mt-0.5">{investment.interestRate}% p.a.</p>
              </div>
            )}
            {investment.ticker && (
              <div>
                <p className="text-text-muted">Ticker</p>
                <p className="text-text-primary font-medium mt-0.5">{investment.ticker} {investment.exchange && `(${investment.exchange})`}</p>
              </div>
            )}
            {investment.folioNumber && (
              <div>
                <p className="text-text-muted">Folio Number</p>
                <p className="text-text-primary font-medium mt-0.5">{investment.folioNumber}</p>
              </div>
            )}
            {investment.platform && (
              <div>
                <p className="text-text-muted">Platform</p>
                <p className="text-text-primary font-medium mt-0.5">{investment.platform}</p>
              </div>
            )}
            {investment.bankAccount && (
              <div>
                <p className="text-text-muted">Linked Account</p>
                <p className="text-text-primary font-medium mt-0.5">{investment.bankAccount.name}</p>
              </div>
            )}
          </div>

          {/* Maturity -- driven directly by the investment's own fields, not
              the windowed Maturity Radar list, so a far-off or already-past
              maturity still shows up here (the radar's 6-month window is
              deliberately narrower; this is the one place with no cutoff). */}
          {investment.maturityDate && (() => {
            const daysUntil = getDaysUntil(investment.maturityDate);
            return (
              <div className="bg-success/8 border border-success/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-success">
                  {daysUntil >= 0
                    ? `Matures ${formatDate(investment.maturityDate)} (${daysUntil} days)`
                    : `Matured ${formatDate(investment.maturityDate)} (${Math.abs(daysUntil)} days ago)`}
                </p>
                {investment.maturityAmount !== null && (
                  <p className="text-xs text-text-secondary mt-0.5">Expected value: {formatCurrency(investment.maturityAmount, 'INR', true)}</p>
                )}
              </div>
            );
          })()}

          {/* Upcoming debits */}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary">Upcoming debits</p>
              {upcoming.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-bg-elevated text-xs">
                  <span className="text-text-secondary">{formatDate(e.date, 'dd MMM yyyy')}</span>
                  <span className="font-mono font-semibold text-text-primary">{formatCurrency(e.amount, 'INR', true)}</span>
                </div>
              ))}
            </div>
          )}

          {investment.notes && (
            <div>
              <p className="text-xs text-text-muted">Notes</p>
              <p className="text-xs text-text-secondary mt-0.5">{investment.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
          <Button type="button" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
