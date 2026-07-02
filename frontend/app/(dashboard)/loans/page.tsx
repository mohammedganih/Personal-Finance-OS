'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, CreditCard as CreditCardIcon, Pencil, Trash2, Users, Landmark, Archive, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLoans, useDeleteLoan } from '@/hooks/useLoans';
import { useCreditCards, useDeleteCreditCard, usePayCreditCardBill } from '@/hooks/useCreditCards';
import { useP2PLoans, useUpdateP2PLoan, useDeleteP2PLoan } from '@/hooks/useP2P';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { LOAN_TYPE_LABELS } from '@/lib/constants';
import { LoanForm } from '@/components/loans/LoanForm';
import { CreditCardForm } from '@/components/loans/CreditCardForm';
import { CardEMIForm } from '@/components/loans/CardEMIForm';
import { PayBillDialog } from '@/components/loans/PayBillDialog';
import { P2PForm } from '@/components/loans/P2PForm';
import { Loan, CreditCard, P2PLoan, CardEMI } from '@/types';
import { useCardEMIs, useUpdateCardEMI, useDeleteCardEMI, useCardEMISummary, usePayCardEMI } from '@/hooks/useCardEMIs';
import { usePayLoanEMI } from '@/hooks/useLoans';
import { cn } from '@/lib/utils';
import { differenceInMonths, parseISO, format, addMonths } from 'date-fns';
import { DebtHealthScore } from '@/components/loans/DebtHealthScore';
import { PayoffStrategyComparison } from '@/components/loans/PayoffStrategyComparison';
import { TotalInterestSaved } from '@/components/loans/TotalInterestSaved';
import { RecommendationCards } from '@/components/loans/RecommendationCards';
import { PrepaymentCalculator } from '@/components/loans/PrepaymentCalculator';
import { EMICalendar } from '@/components/loans/EMICalendar';
import { FundingSources } from '@/components/loans/FundingSources';

const LOAN_ICONS: Record<string, string> = {
  HOME: '🏠', CAR: '🚗', PERSONAL: '💼', EDUCATION: '🎓', BUSINESS: '🏢', OTHER: '💳',
};

function computeLoanStats(loan: Loan) {
  const now   = new Date();
  const start = parseISO(loan.startDate);

  // ── Time tracking ─────────────────────────────────────────────────────────
  const monthsElapsed = Math.max(0, differenceInMonths(now, start));

  // Contracted end date — fixed by the loan agreement, never drifts
  const contractedEndDate = addMonths(start, loan.tenureMonths);

  // Contracted months remaining (how far through the agreed term)
  const contractedMonthsLeft = Math.max(0, loan.tenureMonths - monthsElapsed);

  // ── Projected payoff via amortization formula ─────────────────────────────
  // n = -ln(1 - r×B / EMI) / ln(1+r)
  // where r = monthly rate, B = remaining balance
  // This is the correct formula — unlike B/EMI it accounts for interest
  let projectedMonthsLeft: number;
  const r = loan.interestRate / 100 / 12;

  if (r > 0 && loan.emi > 0) {
    const ratio = (r * loan.remainingBalance) / loan.emi;
    projectedMonthsLeft = ratio >= 1 || ratio <= 0
      ? contractedMonthsLeft   // fallback if data is invalid
      : Math.ceil(-Math.log(1 - ratio) / Math.log(1 + r));
  } else {
    // Interest-free loan — simple division is correct
    projectedMonthsLeft = loan.emi > 0 ? Math.ceil(loan.remainingBalance / loan.emi) : 0;
  }

  const projectedPayoff = addMonths(now, projectedMonthsLeft);

  // Months saved vs contracted (positive = finishing early, negative = behind)
  const monthsDiff = contractedMonthsLeft - projectedMonthsLeft;

  // ── Progress ──────────────────────────────────────────────────────────────
  const amountPaid  = loan.principal - loan.remainingBalance;
  const repaidPct   = loan.principal > 0 ? Math.min((amountPaid / loan.principal) * 100, 100) : 0;
  const timePct     = loan.tenureMonths > 0 ? Math.min((monthsElapsed / loan.tenureMonths) * 100, 100) : 0;
  const totalInterest = Math.max(0, (loan.emi * loan.tenureMonths) - loan.principal);

  // On track = you've repaid at least as much principal as the time elapsed implies
  const isAhead = repaidPct >= timePct;

  return {
    monthsElapsed,
    contractedMonthsLeft,
    projectedMonthsLeft,
    contractedEndDate,
    projectedPayoff,
    monthsDiff,
    amountPaid,
    repaidPct,
    timePct,
    totalInterest,
    isAhead,
  };
}

// ─── Loans Tab ────────────────────────────────────────────────────────────────
function LoansTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const { data: loans, isLoading } = useLoans();
  const { mutate: deleteLoan } = useDeleteLoan();
  const { mutate: payEMI, isPending: isPaying } = usePayLoanEMI();

  const active = (loans ?? []).filter((l) => l.isActive);
  const totalEMI = active.reduce((s, l) => s + l.emi, 0);
  const totalDebt = active.reduce((s, l) => s + l.remainingBalance, 0);
  const totalPrincipal = active.reduce((s, l) => s + l.principal, 0);
  const overallPct = totalPrincipal > 0 ? ((totalPrincipal - totalDebt) / totalPrincipal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{active.length} active loan{active.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => { setEditingLoan(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Loan
        </Button>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Outstanding', value: totalDebt, color: 'text-danger' },
            { label: 'Monthly EMI', value: totalEMI, color: 'text-warning' },
            { label: 'Repaid', value: totalPrincipal - totalDebt, color: 'text-success' },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <p className="text-xs text-text-secondary">{s.label}</p>
              <p className={cn('text-lg font-bold mt-1', s.color)}>{formatCurrency(s.value, 'INR', true)}</p>
            </div>
          ))}
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Overall Progress</p>
            <p className="text-lg font-bold text-text-primary mt-1">{overallPct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-44 shimmer" />
        )) : active.length === 0 ? (
          <EmptyState icon={Landmark} title="No loans tracked" description="Add your loans and track EMI payments" action={{ label: 'Add Loan', onClick: () => setShowForm(true) }} />
        ) : active.map((loan) => {
          const s = computeLoanStats(loan);
          return (
            <div key={loan.id} className="glass-card-hover rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-lg shrink-0">{LOAN_ICONS[loan.loanType] ?? '💳'}</div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{loan.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">{LOAN_TYPE_LABELS[loan.loanType]}</Badge>
                      {loan.lender && <span className="text-xs text-text-muted">{loan.lender}</span>}
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', s.isAhead ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                        {s.isAhead ? '✓ On track' : '⚠ Behind'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Pay EMI button */}
                  {payingLoanId === loan.id ? (
                    <div className="flex items-center gap-1.5 mr-1">
                      <span className="text-xs text-text-secondary">Pay ₹{Math.round(loan.emi).toLocaleString('en-IN')}?</span>
                      <button
                        onClick={() => { payEMI({ id: loan.id }); setPayingLoanId(null); }}
                        disabled={isPaying}
                        className="px-2.5 py-1 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors"
                      >
                        {isPaying ? '...' : 'Confirm'}
                      </button>
                      <button onClick={() => setPayingLoanId(null)} className="px-2 py-1 rounded-lg bg-bg-elevated text-text-muted text-xs hover:text-text-primary transition-colors">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPayingLoanId(loan.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors mr-1"
                    >
                      ✓ Pay EMI
                    </button>
                  )}
                  <button aria-label={`Edit ${loan.name}`} onClick={() => { setEditingLoan(loan); setShowForm(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button aria-label={`Delete ${loan.name}`} onClick={() => deleteLoan(loan.id)} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-bg-elevated rounded-xl p-3"><p className="text-xs text-text-muted">EMI</p><p className="text-sm font-bold font-mono text-text-primary">{formatCurrency(loan.emi, 'INR', true)}</p></div>
                <div className="bg-bg-elevated rounded-xl p-3"><p className="text-xs text-text-muted">Remaining</p><p className="text-sm font-bold font-mono text-danger">{formatCurrency(loan.remainingBalance, 'INR', true)}</p></div>
                <div className="bg-bg-elevated rounded-xl p-3"><p className="text-xs text-text-muted">Repaid</p><p className="text-sm font-bold font-mono text-success">{formatCurrency(s.amountPaid, 'INR', true)}</p></div>
                <div className="bg-bg-elevated rounded-xl p-3"><p className="text-xs text-text-muted">Rate</p><p className="text-sm font-bold text-text-primary">{loan.interestRate}% p.a.</p></div>
              </div>
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Principal Repaid</span>
                  <span className="text-text-primary font-semibold">{s.repaidPct.toFixed(1)}%</span>
                </div>
                <div className="relative h-2.5 bg-bg-overlay rounded-full overflow-hidden">
                  {/* Green = principal repaid so far */}
                  <div className="absolute inset-y-0 left-0 bg-gradient-success rounded-full transition-all duration-500" style={{ width: `${s.repaidPct}%` }} />
                  {/* Orange marker = time elapsed through agreed tenure */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-warning/70" style={{ left: `${Math.min(s.timePct, 99)}%` }} title="Time elapsed" />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Started {formatDate(loan.startDate, 'MMM yyyy')}</span>
                  <span>{s.monthsElapsed}mo elapsed · {s.contractedMonthsLeft}mo contracted left</span>
                  <span>Ends {format(s.contractedEndDate, 'MMM yyyy')}</span>
                </div>
              </div>

              {/* Projected payoff (if different from contracted) */}
              {Math.abs(s.monthsDiff) >= 1 && (
                <div className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2 text-xs',
                  s.monthsDiff > 0 ? 'bg-success/8 border border-success/20' : 'bg-warning/8 border border-warning/20'
                )}>
                  <span className={s.monthsDiff > 0 ? 'text-success' : 'text-warning'}>
                    {s.monthsDiff > 0
                      ? `🎉 Finishing ~${s.monthsDiff}mo early based on remaining balance`
                      : `⚠ Projected ${Math.abs(s.monthsDiff)}mo over contracted tenure`}
                  </span>
                  <span className="text-text-muted">
                    Projected: {format(s.projectedPayoff, 'MMM yyyy')}
                  </span>
                </div>
              )}

              {/* Interest breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border text-xs">
                <div>
                  <p className="text-text-muted">Principal</p>
                  <p className="font-mono text-text-secondary">{formatCurrency(loan.principal, 'INR', true)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Total Interest ({loan.tenureMonths}mo)</p>
                  <p className="font-mono text-text-secondary">{formatCurrency(s.totalInterest, 'INR', true)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Total Payable</p>
                  <p className="font-mono text-text-secondary">{formatCurrency(loan.emi * loan.tenureMonths, 'INR', true)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && <LoanForm onClose={() => { setShowForm(false); setEditingLoan(null); }} loan={editingLoan ?? undefined} />}
    </div>
  );
}

// ─── Credit Cards Tab ─────────────────────────────────────────────────────────
function CreditCardsTab() {
  const [subTab, setSubTab] = useState<'cards' | 'emis'>('cards');
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [showEMIForm, setShowEMIForm] = useState(false);
  const [editingEMI, setEditingEMI] = useState<CardEMI | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: cards, isLoading: cardsLoading } = useCreditCards();
  const { mutate: deleteCard } = useDeleteCreditCard();
  const { data: emis, isLoading: emisLoading } = useCardEMIs(showArchived);
  const { data: emisSummary } = useCardEMISummary();
  const { mutate: updateEMI } = useUpdateCardEMI();
  const { mutate: deleteEMI } = useDeleteCardEMI();
  const { mutate: payCardEMI, isPending: isPayingEMI } = usePayCardEMI();

  const [payingCardId, setPayingCardId]   = useState<string | null>(null);
  const [payingEMIId, setPayingEMIId]     = useState<string | null>(null);
  const payingCard = (cards ?? []).find((c) => c.id === payingCardId) ?? null;

  // Total outstanding = revolving + EMI outstanding
  const revolvingOutstanding = (cards ?? []).reduce((s, c) => s + c.outstanding, 0);
  const emiOutstanding = emisSummary?.totalOutstanding ?? 0;
  const totalOutstanding = revolvingOutstanding + emiOutstanding;
  const totalLimit = (cards ?? []).reduce((s, c) => s + c.creditLimit, 0);
  const utilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  const activeEMIs = (emis ?? []).filter((e) => !e.isArchived);
  const archivedEMIs = (emis ?? []).filter((e) => e.isArchived);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bg-elevated rounded-xl p-1 border border-border">
          {(['cards', 'emis'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
                subTab === t
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {t === 'cards' ? '💳 Cards' : `📆 EMIs${activeEMIs.length > 0 ? ` (${activeEMIs.length})` : ''}`}
            </button>
          ))}
        </div>
        {subTab === 'cards' ? (
          <Button size="sm" onClick={() => { setEditingCard(null); setShowCardForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Card
          </Button>
        ) : (
          <Button size="sm" onClick={() => { setEditingEMI(null); setShowEMIForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add EMI
          </Button>
        )}
      </div>

      {/* Summary strip — always visible */}
      {(cards ?? []).length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs text-text-muted">Revolving</p>
            <p className="text-base font-bold text-danger mt-0.5">{formatCurrency(revolvingOutstanding, 'INR', true)}</p>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs text-text-muted">EMI Blocked</p>
            <p className="text-base font-bold text-warning mt-0.5">{formatCurrency(emiOutstanding, 'INR', true)}</p>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs text-text-muted">Total Outstanding</p>
            <p className="text-base font-bold text-danger mt-0.5">{formatCurrency(totalOutstanding, 'INR', true)}</p>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs text-text-muted">Utilization</p>
            <p className={cn('text-base font-bold mt-0.5', utilization > 30 ? 'text-danger' : 'text-success')}>{utilization.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* ── CARDS sub-tab ── */}
      {subTab === 'cards' && (
        <div className="space-y-3">
          {cardsLoading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-36 shimmer" />) :
            (cards ?? []).length === 0 ? (
              <EmptyState icon={CreditCardIcon} title="No credit cards" description="Track your credit card bills and utilization" action={{ label: 'Add Card', onClick: () => setShowCardForm(true) }} />
            ) : (cards ?? []).map((card) => {
              const cardEmisForCard = (emis ?? []).filter((e) => e.creditCardId === card.id && !e.isArchived);
              const cardEMIOut = cardEmisForCard.reduce((s, e) => s + e.outstanding, 0);
              const cardEMIMonthly = cardEmisForCard.reduce((s, e) => s + e.emiAmount, 0);
              const effectiveOutstanding = card.outstanding + cardEMIOut;
              const cardUtil = card.creditLimit > 0 ? (effectiveOutstanding / card.creditLimit) * 100 : 0;
              const daysUntilDue = getDaysUntil(card.dueDate);
              const available = card.creditLimit - effectiveOutstanding;

              return (
                <div key={card.id} className="glass-card-hover rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: card.color ? `${card.color}20` : 'rgba(99,102,241,0.15)' }}>💳</div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {card.cardName}
                          {card.lastFourDigits && <span className="text-text-muted font-normal ml-1">···· {card.lastFourDigits}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {card.bank && <span className="text-xs text-text-muted">{card.bank}</span>}
                          {card.interestRate && <Badge variant="secondary" className="text-xs">{card.interestRate}% p.a.</Badge>}
                          <span className={cn('text-xs font-medium', daysUntilDue <= 3 ? 'text-danger font-semibold' : daysUntilDue <= 7 ? 'text-warning' : 'text-text-muted')}>
                            {daysUntilDue <= 0 ? '⚠ Due TODAY' : `Due in ${daysUntilDue}d`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {card.outstanding > 0 && (
                        <button
                          onClick={() => setPayingCardId(card.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors mr-1"
                        >
                          ✓ Pay Bill
                        </button>
                      )}
                      <button aria-label={`Edit ${card.cardName}`} onClick={() => { setEditingCard(card); setShowCardForm(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button aria-label={`Delete ${card.cardName}`} onClick={() => deleteCard(card.id)} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-bg-elevated rounded-xl p-2.5">
                      <p className="text-xs text-text-muted">Revolving</p>
                      <p className="text-sm font-bold font-mono text-danger">{formatCurrency(card.outstanding, 'INR', true)}</p>
                    </div>
                    <div className="bg-bg-elevated rounded-xl p-2.5">
                      <p className="text-xs text-text-muted">EMI Blocked</p>
                      <p className="text-sm font-bold font-mono text-warning">{formatCurrency(cardEMIOut, 'INR', true)}</p>
                    </div>
                    <div className="bg-bg-elevated rounded-xl p-2.5">
                      <p className="text-xs text-text-muted">Available</p>
                      <p className="text-sm font-bold font-mono text-success">{formatCurrency(Math.max(0, available), 'INR', true)}</p>
                    </div>
                    <div className="bg-bg-elevated rounded-xl p-2.5">
                      <p className="text-xs text-text-muted">{card.minimumPayment ? 'Min Pay' : 'Limit'}</p>
                      <p className="text-sm font-bold font-mono text-text-primary">{formatCurrency(card.minimumPayment ?? card.creditLimit, 'INR', true)}</p>
                    </div>
                  </div>

                  {/* EMI summary on card */}
                  {cardEmisForCard.length > 0 && (
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-warning/5 border border-warning/15 px-3 py-2">
                      <span className="text-xs text-warning">
                        {cardEmisForCard.length} active EMI{cardEmisForCard.length > 1 ? 's' : ''} · {formatCurrency(cardEMIMonthly, 'INR', true)}/mo deducted
                      </span>
                      <button
                        onClick={() => setSubTab('emis')}
                        className="text-xs text-accent-violet-light hover:underline"
                      >
                        View EMIs →
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Total Utilization (incl. EMIs)</span>
                      <span className={cn('font-semibold', cardUtil > 50 ? 'text-danger' : cardUtil > 30 ? 'text-warning' : 'text-success')}>{cardUtil.toFixed(1)}%</span>
                    </div>
                    <Progress value={cardUtil} className="h-2" indicatorClassName={cardUtil > 50 ? 'bg-gradient-danger' : cardUtil > 30 ? 'bg-gradient-warning' : 'bg-gradient-success'} />
                    <p className="text-xs text-text-muted">Due {formatDate(card.dueDate)}{card.statementDate && ` · Statement ${formatDate(card.statementDate)}`}</p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── EMIs sub-tab ── */}
      {subTab === 'emis' && (
        <div className="space-y-3">
          {/* EMI summary */}
          {activeEMIs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-text-secondary">Monthly EMI Deduction</p>
                <p className="text-lg font-bold text-warning mt-1">{formatCurrency(emisSummary?.monthlyBurden ?? 0, 'INR', true)}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-text-secondary">Total EMI Outstanding</p>
                <p className="text-lg font-bold text-danger mt-1">{formatCurrency(emisSummary?.totalOutstanding ?? 0, 'INR', true)}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-text-secondary">Active EMIs</p>
                <p className="text-lg font-bold text-text-primary mt-1">{activeEMIs.length}</p>
              </div>
            </div>
          )}

          {emisLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />) :
            activeEMIs.length === 0 ? (
              <EmptyState
                icon={CreditCardIcon}
                title="No active Card EMIs"
                description="Add EMIs for purchases converted to monthly payments on your credit card"
                action={{ label: 'Add EMI', onClick: () => setShowEMIForm(true) }}
              />
            ) : activeEMIs.map((emi) => (
              <div key={emi.id} className="glass-card-hover rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center text-lg shrink-0">📦</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{emi.itemName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {emi.creditCard && (
                            <span className="text-xs text-text-muted">
                              {emi.creditCard.cardName}{emi.creditCard.lastFourDigits ? ` ···· ${emi.creditCard.lastFourDigits}` : ''}
                            </span>
                          )}
                          <Badge variant={emi.isNoCost ? 'success' : 'warning'} className="text-xs">
                            {emi.isNoCost ? '0% No-Cost' : `${emi.interestRate}% p.a.`}
                          </Badge>
                          <span className="text-xs text-text-muted">
                            {emi.emisPaid}/{emi.tenureMonths} paid · {emi.emisRemaining} left
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        <p className="text-sm font-bold font-mono text-warning">{formatCurrency(emi.emiAmount, 'INR', true)}/mo</p>
                        <p className="text-xs text-text-muted font-mono">{formatCurrency(emi.outstanding, 'INR', true)} left</p>

                        {/* Pay this month / confirm inline */}
                        {payingEMIId === emi.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { payCardEMI({ id: emi.id }); setPayingEMIId(null); }}
                              disabled={isPayingEMI}
                              className="px-2 py-1 rounded bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors"
                            >
                              {isPayingEMI ? '...' : 'Confirm'}
                            </button>
                            <button onClick={() => setPayingEMIId(null)} className="px-1.5 py-1 rounded bg-bg-elevated text-text-muted text-xs">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPayingEMIId(emi.id)}
                            className="px-2 py-1 rounded bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                          >
                            ✓ Pay
                          </button>
                        )}

                        <div className="flex gap-1">
                          <button aria-label={`Edit ${emi.itemName}`} onClick={() => { setEditingEMI(emi); setShowEMIForm(true); }} className="p-1 rounded text-text-muted hover:text-accent-violet-light transition-colors"><Pencil className="w-3 h-3" /></button>
                          <button aria-label={`Archive ${emi.itemName}`} onClick={() => updateEMI({ id: emi.id, data: { isArchived: true } })} className="p-1 rounded text-text-muted hover:text-success transition-colors" title="Archive"><Archive className="w-3 h-3" /></button>
                          <button aria-label={`Delete ${emi.itemName}`} onClick={() => deleteEMI(emi.id)} className="p-1 rounded text-text-muted hover:text-danger transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-1">
                      <Progress value={emi.progressPct} className="h-1.5" indicatorClassName="bg-gradient-success" />
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>{formatCurrency(emi.totalAmount, 'INR', true)} total</span>
                        <span>{emi.progressPct.toFixed(0)}% complete</span>
                        <span>Started {formatDate(emi.startDate, 'MMM yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Archived toggle */}
          {archivedEMIs.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? 'Hide' : 'Show'} {archivedEMIs.length} archived EMI{archivedEMIs.length !== 1 ? 's' : ''}
            </button>
          )}

          {showArchived && archivedEMIs.map((emi) => (
            <div key={emi.id} className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 opacity-50">
              <span className="text-base">✅</span>
              <p className="text-sm text-text-secondary flex-1">{emi.itemName}</p>
              <p className="text-xs font-mono text-text-muted">{formatCurrency(emi.totalAmount, 'INR', true)}</p>
              <Badge variant="secondary" className="text-xs">Completed</Badge>
              <button aria-label={`Delete ${emi.itemName}`} onClick={() => deleteEMI(emi.id)} className="text-text-muted hover:text-danger"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {showCardForm && <CreditCardForm onClose={() => { setShowCardForm(false); setEditingCard(null); }} card={editingCard ?? undefined} />}
      {showEMIForm && <CardEMIForm onClose={() => { setShowEMIForm(false); setEditingEMI(null); }} emi={editingEMI ?? undefined} />}
      {payingCard && <PayBillDialog card={payingCard} onClose={() => setPayingCardId(null)} />}
    </div>
  );
}

// ─── P2P Tab ──────────────────────────────────────────────────────────────────
function P2PTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<P2PLoan | null>(null);
  const { data: loans, isLoading } = useP2PLoans();
  const { mutate: updateLoan } = useUpdateP2PLoan();
  const { mutate: deleteLoan } = useDeleteP2PLoan();

  const active = (loans ?? []).filter((l) => !l.isSettled);
  const settled = (loans ?? []).filter((l) => l.isSettled);
  const lent = active.filter((l) => l.type === 'LENT').reduce((s, l) => s + l.remainingAmount, 0);
  const borrowed = active.filter((l) => l.type === 'BORROWED').reduce((s, l) => s + l.remainingAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{active.length} active entries</p>
        <Button size="sm" onClick={() => { setEditingLoan(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Entry
        </Button>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-4"><p className="text-xs text-text-secondary">Lent (they owe me)</p><p className="text-lg font-bold text-success mt-1">{formatCurrency(lent, 'INR', true)}</p></div>
          <div className="glass-card rounded-2xl p-4"><p className="text-xs text-text-secondary">Borrowed (I owe)</p><p className="text-lg font-bold text-danger mt-1">{formatCurrency(borrowed, 'INR', true)}</p></div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Net Position</p>
            <p className={cn('text-lg font-bold mt-1', lent >= borrowed ? 'text-success' : 'text-danger')}>
              {lent >= borrowed ? '+' : ''}{formatCurrency(lent - borrowed, 'INR', true)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-16 shimmer" />) :
          active.length === 0 && settled.length === 0 ? (
            <EmptyState icon={Users} title="No P2P entries" description="Track money lent to or borrowed from friends and family" action={{ label: 'Add Entry', onClick: () => setShowForm(true) }} />
          ) : (
            <>
              {active.map((loan) => {
                const paidBack = loan.amount - loan.remainingAmount;
                const pct = loan.amount > 0 ? (paidBack / loan.amount) * 100 : 0;
                const daysLeft = loan.dueDate ? getDaysUntil(loan.dueDate) : null;
                const isLent = loan.type === 'LENT';
                return (
                  <div key={loan.id} className="glass-card-hover rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0', isLent ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                        {isLent ? '↑' : '↓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">{loan.personName}</p>
                          <Badge variant={isLent ? 'success' : 'danger'} className="text-xs">{isLent ? 'Lent' : 'Borrowed'}</Badge>
                          {daysLeft !== null && (
                            <span className={cn('text-xs', daysLeft < 0 ? 'text-danger font-medium' : daysLeft <= 7 ? 'text-warning' : 'text-text-muted')}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`}
                            </span>
                          )}
                        </div>
                        {loan.description && <p className="text-xs text-text-muted truncate mt-0.5">{loan.description}</p>}
                        {paidBack > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <Progress value={pct} className="h-1 flex-1" indicatorClassName="bg-gradient-success" />
                            <span className="text-xs text-text-muted shrink-0">{pct.toFixed(0)}% settled</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-bold font-mono', isLent ? 'text-success' : 'text-danger')}>{formatCurrency(loan.remainingAmount, 'INR', true)}</p>
                        {paidBack > 0 && <p className="text-xs text-text-muted">{formatCurrency(paidBack, 'INR', true)} returned</p>}
                        <p className="text-xs text-text-muted">{formatDate(loan.date, 'dd MMM yy')}</p>
                      </div>
                      <div className="flex flex-col gap-1 ml-1">
                        <button onClick={() => { setEditingLoan(loan); setShowForm(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors" title="Edit"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => updateLoan({ id: loan.id, data: { isSettled: true } })} className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors text-xs" title="Mark as settled">✓</button>
                        <button onClick={() => deleteLoan(loan.id)} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Delete"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {settled.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-text-muted mb-2">Settled ({settled.length})</p>
                  <div className="space-y-1.5">
                    {settled.map((loan) => (
                      <div key={loan.id} className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 opacity-50">
                        <span className="text-sm">{loan.type === 'LENT' ? '↑' : '↓'}</span>
                        <p className="text-sm text-text-secondary flex-1">{loan.personName}</p>
                        <p className="text-sm font-mono text-text-muted">{formatCurrency(loan.amount, 'INR', true)}</p>
                        <Badge variant="secondary" className="text-xs">Settled</Badge>
                        <button aria-label={`Delete settled entry with ${loan.personName}`} onClick={() => deleteLoan(loan.id)} className="text-text-muted hover:text-danger"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
      </div>

      {showForm && <P2PForm onClose={() => { setShowForm(false); setEditingLoan(null); }} loan={editingLoan ?? undefined} />}
    </div>
  );
}

// ─── Debt Insights Tab ────────────────────────────────────────────────────────
function DebtInsightsTab() {
  return (
    <div className="space-y-4">
      <TotalInterestSaved />
      <DebtHealthScore />
      <RecommendationCards />
      <FundingSources />
      <PayoffStrategyComparison />
      <PrepaymentCalculator />
      <EMICalendar />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LoansPage() {
  const { data: loans } = useLoans();
  const { data: cards } = useCreditCards();
  const { data: p2p } = useP2PLoans();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'insights' ? 'insights' : 'loans';

  const loanCount = (loans ?? []).filter((l) => l.isActive).length;
  const cardCount = (cards ?? []).length;
  const p2pCount  = (p2p ?? []).filter((l) => !l.isSettled).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Loans & Liabilities</h2>
        <p className="text-sm text-text-secondary mt-0.5">Loans · Credit Cards · Peer-to-Peer</p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="loans">
            <Landmark className="w-3.5 h-3.5" />
            Loans {loanCount > 0 && <span className="ml-1 text-xs bg-bg-overlay px-1.5 py-0.5 rounded-full">{loanCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="credit-cards">
            <CreditCardIcon className="w-3.5 h-3.5" />
            Credit Cards {cardCount > 0 && <span className="ml-1 text-xs bg-bg-overlay px-1.5 py-0.5 rounded-full">{cardCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="p2p">
            <Users className="w-3.5 h-3.5" />
            P2P {p2pCount > 0 && <span className="ml-1 text-xs bg-bg-overlay px-1.5 py-0.5 rounded-full">{p2pCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="w-3.5 h-3.5" />
            Debt Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="loans"><LoansTab /></TabsContent>
        <TabsContent value="credit-cards"><CreditCardsTab /></TabsContent>
        <TabsContent value="p2p"><P2PTab /></TabsContent>
        <TabsContent value="insights"><DebtInsightsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
