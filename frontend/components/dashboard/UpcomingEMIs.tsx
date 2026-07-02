'use client';

import { CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useLoans } from '@/hooks/useLoans';
import { useCardEMIs } from '@/hooks/useCardEMIs';
import { LOAN_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { addMonths, startOfMonth } from 'date-fns';

export function UpcomingEMIs() {
  const { data: loans } = useLoans();
  const { data: cardEmis } = useCardEMIs();

  const activeLoans   = (loans ?? []).filter((l) => l.isActive);
  const activeCardEMIs = (cardEmis ?? []).filter((e) => !e.isArchived && e.emisRemaining > 0);

  const totalLoanEMI   = activeLoans.reduce((s, l) => s + l.emi, 0);
  const totalCardEMI   = activeCardEMIs.reduce((s, e) => s + e.emiAmount, 0);
  const totalMonthlyEMI = totalLoanEMI + totalCardEMI;

  const nextEmiDate = startOfMonth(addMonths(new Date(), 1));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Monthly EMI Outflow</h3>
          <p className="text-xs text-text-secondary mt-0.5">{formatDate(nextEmiDate, 'MMMM yyyy')}</p>
        </div>
        <CreditCard className="w-4 h-4 text-text-muted" />
      </div>

      {activeLoans.length === 0 && activeCardEMIs.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No active EMIs</p>
      ) : (
        <div className="space-y-2">
          {/* Loan EMIs */}
          {activeLoans.map((loan) => (
            <div key={loan.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center text-sm shrink-0">💳</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{loan.name}</p>
                <p className="text-xs text-text-muted">{LOAN_TYPE_LABELS[loan.loanType]}</p>
              </div>
              <p className="text-xs font-semibold font-mono text-text-primary shrink-0">
                {formatCurrency(loan.emi, 'INR', true)}
              </p>
            </div>
          ))}

          {/* Card EMIs */}
          {activeCardEMIs.map((emi) => (
            <div key={emi.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
              <div className="w-8 h-8 rounded-lg bg-accent-violet/10 flex items-center justify-center text-sm shrink-0">📦</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{emi.itemName}</p>
                <p className="text-xs text-text-muted">
                  {emi.creditCard?.cardName ?? 'Card EMI'} · {emi.emisRemaining}mo left
                </p>
              </div>
              <p className="text-xs font-semibold font-mono text-warning shrink-0">
                {formatCurrency(emi.emiAmount, 'INR', true)}
              </p>
            </div>
          ))}

          {/* Total footer */}
          {(activeLoans.length > 0 || activeCardEMIs.length > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="text-xs font-medium text-text-secondary">Total Monthly EMI</p>
                {totalCardEMI > 0 && (
                  <p className="text-xs text-text-muted">
                    {formatCurrency(totalLoanEMI, 'INR', true)} loans + {formatCurrency(totalCardEMI, 'INR', true)} card
                  </p>
                )}
              </div>
              <p className="text-sm font-bold text-warning font-mono">
                {formatCurrency(totalMonthlyEMI, 'INR', true)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
