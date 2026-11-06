'use client';

import { useState } from 'react';
import { differenceInMonths } from 'date-fns';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Plus, ChevronDown } from 'lucide-react';
import { useLoans, useDeleteLoan, usePayLoanEMI } from '@/hooks/useLoans';
import { LOAN_TYPE_ICONS, LOAN_TYPE_COLORS } from '@/lib/loanTypeMeta';
import { LOAN_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';
import { Loan } from '@/types';
import { cn } from '@/lib/utils';
import { LoanForm } from '@/components/loans/LoanForm';
import { PrepayLoanDialog, ChangeRateDialog } from '@/components/loans/LoanChangeDialogs';
import { PaymentHistoryDialog } from '@/components/shared/PaymentHistoryDialog';
import type { HistoryType } from '@/hooks/usePaymentHistory';

function monthsLeftLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y > 0 && m > 0) return `${y}y ${m}mo left`;
  if (y > 0) return `${y}yr${y === 1 ? '' : 's'} left`;
  return `${m}mo left`;
}

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="min-w-40 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'px-3.5 py-2 text-xs font-medium cursor-pointer outline-none transition-colors',
        danger ? 'text-updown-down hover:bg-updown-down-muted' : 'text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary'
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function YourLoansTable() {
  const { data: loans, isLoading: loansLoading } = useLoans();
  const { mutate: deleteLoan } = useDeleteLoan();
  const { mutate: payEMI, isPending: isPayingEMI } = usePayLoanEMI();

  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [prepaying, setPrepaying] = useState<Loan | null>(null);
  const [changingRate, setChangingRate] = useState<Loan | null>(null);
  const [historyFor, setHistoryFor] = useState<{ type: HistoryType; id: string; name: string } | null>(null);

  if (loansLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  const activeLoans = (loans ?? []).filter((l) => l.isActive);
  const closedLoans = (loans ?? []).filter((l) => !l.isActive);

  const now = new Date();

  return (
    <div id="your-loans" className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Your Loans</h3>
          <p className="text-xs text-ink-muted">Credit cards, statements and card EMIs are on <Link href="/credit-cards" className="underline underline-offset-2 hover:text-ink-primary">Credit Cards</Link>.</p>
        </div>
        <button
          onClick={() => { setEditingLoan(null); setShowLoanForm(true); }}
          className="w-7 h-7 rounded-full bg-paper-subtle hover:bg-line flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          aria-label="Add loan"
          title="Add loan"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {activeLoans.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No loans tracked yet</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Loan</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Outstanding</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Interest Rate</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">EMI &amp; Tenure</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Progress</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {activeLoans.map((loan) => {
                const Icon = LOAN_TYPE_ICONS[loan.loanType];
                const color = LOAN_TYPE_COLORS[loan.loanType];
                const monthsElapsed = Math.max(0, differenceInMonths(now, new Date(loan.startDate)));
                const monthsLeft = Math.max(0, loan.tenureMonths - monthsElapsed);
                const repaidPct = loan.principal > 0 ? Math.min(((loan.principal - loan.remainingBalance) / loan.principal) * 100, 100) : 0;

                return (
                  <tr key={loan.id}>
                    <td className="px-1 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-paper-subtle flex items-center justify-center shrink-0" style={{ color }}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <p className="text-sm font-medium text-ink-primary truncate">{loan.name}</p>
                          <p className="text-xs text-ink-muted truncate">{loan.lender ?? LOAN_TYPE_LABELS[loan.loanType]}</p>
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-3.5 whitespace-nowrap">
                      <p className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(loan.remainingBalance, 'INR', true)}</p>
                      <p className="text-xs text-ink-muted tabular-nums">of {formatCurrency(loan.principal, 'INR', true)}</p>
                    </td>
                    <td className="px-1 py-3.5 whitespace-nowrap">
                      <p className="text-sm text-ink-primary tabular-nums">{loan.interestRate}%</p>
                      <p className="text-xs text-ink-muted">Fixed</p>
                    </td>
                    <td className="px-1 py-3.5 whitespace-nowrap">
                      <p className="text-sm text-ink-primary tabular-nums">{formatCurrency(loan.emi, 'INR', true)} / month</p>
                      <p className="text-xs text-ink-muted">{monthsLeftLabel(monthsLeft)}</p>
                    </td>
                    <td className="px-1 py-3.5 min-w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-ink-primary tabular-nums">{repaidPct.toFixed(1)}%</span>
                        <span className="text-[10px] text-ink-muted">Paid Off</span>
                      </div>
                      <div className="h-1.5 bg-paper-subtle rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${repaidPct}%`, background: color }} />
                      </div>
                    </td>
                    <td className="px-1 py-3.5 text-right">
                      {payingLoanId === loan.id ? (
                        <div className="flex items-center gap-1 justify-end whitespace-nowrap">
                          <button
                            onClick={() => { payEMI({ id: loan.id }); setPayingLoanId(null); }}
                            disabled={isPayingEMI}
                            className="px-2 py-1 rounded-lg bg-updown-up-muted text-updown-up text-xs font-medium"
                          >
                            {isPayingEMI ? '...' : 'Confirm'}
                          </button>
                          <button onClick={() => setPayingLoanId(null)} className="px-1.5 py-1 rounded-lg text-ink-muted text-xs">✕</button>
                        </div>
                      ) : (
                        <RowMenu>
                          <MenuItem onSelect={() => setPayingLoanId(loan.id)}>Pay EMI</MenuItem>
                          <MenuItem onSelect={() => setPrepaying(loan)}>Prepay / part-pay</MenuItem>
                          <MenuItem onSelect={() => setChangingRate(loan)}>Change interest rate</MenuItem>
                          <MenuItem onSelect={() => setHistoryFor({ type: 'LOAN', id: loan.id, name: loan.name })}>History</MenuItem>
                          <MenuItem onSelect={() => { setEditingLoan(loan); setShowLoanForm(true); }}>Edit</MenuItem>
                          <MenuItem danger onSelect={() => deleteLoan(loan.id)}>Delete</MenuItem>
                        </RowMenu>
                      )}
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      )}

      {closedLoans.length > 0 && (
        <>
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
          >
            {showClosed ? 'Hide' : 'View'} Closed Loans ({closedLoans.length})
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showClosed && 'rotate-180')} />
          </button>

          {showClosed && (
            <div className="mt-3 space-y-2">
              {closedLoans.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper-subtle px-3.5 py-2.5 opacity-70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-medium text-ink-primary truncate">{loan.name}</span>
                    <span className="text-[11px] text-ink-muted">{LOAN_TYPE_LABELS[loan.loanType]}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-ink-muted">Paid off {formatDate(loan.updatedAt, 'MMM yyyy')}</span>
                    <button onClick={() => setHistoryFor({ type: 'LOAN', id: loan.id, name: loan.name })} className="text-ink-muted hover:text-ink-primary transition-colors text-xs underline underline-offset-2">History</button>
                    <button aria-label={`Delete ${loan.name}`} onClick={() => deleteLoan(loan.id)} className="text-ink-muted hover:text-updown-down transition-colors text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showLoanForm && <LoanForm onClose={() => { setShowLoanForm(false); setEditingLoan(null); }} loan={editingLoan ?? undefined} />}
      {prepaying && <PrepayLoanDialog loan={prepaying} onClose={() => setPrepaying(null)} />}
      {changingRate && <ChangeRateDialog loan={changingRate} onClose={() => setChangingRate(null)} />}
      {historyFor && <PaymentHistoryDialog {...historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
