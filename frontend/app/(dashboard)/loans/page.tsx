'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useLoanRegister, LoanRow } from '@/hooks/useRegisters';
import { useLoans, useDeleteLoan } from '@/hooks/useLoans';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { RegisterPage, RegisterTable, RegisterColumn, DetailDrawer, DrawerSection, NextDueCell, Facts } from '@/components/register/Register';
import { PaymentActions } from '@/components/shared/PaymentActions';
import { PaymentHistoryList } from '@/components/shared/PaymentHistoryList';
import { PrepayLoanDialog, ChangeRateDialog } from '@/components/loans/LoanChangeDialogs';
import { LoanForm } from '@/components/loans/LoanForm';
import { P2PSummaryCard } from '@/components/loans/P2PSummaryCard';
import { Loan } from '@/types';

// Loans: what we owe, who pays, when each ends. Card EMIs live with their card
// (Credit cards) and still count under Loans & EMIs on Home.

const month = (m: string | null) => (m ? formatDate(`${m}-01`, 'MMM yyyy') : '—');
const btn = 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-paper-subtle';

export default function LoansPage() {
  const { data, isLoading, isError } = useLoanRegister();
  const { data: loans } = useLoans();
  const { data: members } = useFamilyMembers();
  const remove = useDeleteLoan();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'prepay' | 'rate' | 'edit'>(null);

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const who = (id: string | null) => (id ? names.get(id) ?? 'Someone' : 'Not set');
  const all = [...(data?.loans ?? []), ...(data?.closed ?? [])];
  const open = all.find((l) => l.id === openId) ?? null;
  const full = (loans ?? []).find((l: Loan) => l.id === openId) ?? null;

  const columns: RegisterColumn<LoanRow>[] = [
    {
      key: 'name', header: 'Loan', className: 'w-[34%] sm:w-auto',
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-primary">{l.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {who(l.payerMemberId)} pays{l.debitedFromMemberId ? ` · debited from ${who(l.debitedFromMemberId)}'s account` : ''}
          </p>
        </div>
      ),
    },
    { key: 'emi', header: 'EMI', numeric: true, hideOnPhone: true, cell: (l) => formatCurrency(l.emi) },
    { key: 'left', header: 'Left to repay', numeric: true, cell: (l) => <span className="font-medium text-ink-primary">{formatCurrency(l.left)}</span> },
    { key: 'ends', header: 'Ends', hideOnPhone: true, cell: (l) => month(l.amortisation.endsMonth) },
    { key: 'next', header: 'Next due', cell: (l) => <NextDueCell dueDate={l.next?.dueDate} status={l.next?.status} /> },
  ];

  return (
    <RegisterPage
      totals={[
        { label: 'Total left to repay', value: data ? formatCurrency(data.totals.totalLeft) : '—' },
        { label: 'EMIs this month', value: data ? formatCurrency(data.totals.monthlyEmis) : '—' },
        { label: 'Debt-free', value: data ? month(data.totals.debtFreeMonth) : '—', note: data?.totals.debtFreeName ? `when ${data.totals.debtFreeName} ends` : undefined },
      ]}
    >
      {isLoading && <div className="card-light h-64 shimmer" />}
      {isError && <p role="alert" className="card-light p-5 text-sm text-ink-secondary">Could not load your loans. Please refresh.</p>}
      {data && (
        <RegisterTable title="Loans" columns={columns} rows={data.loans} rowKey={(l) => l.id} onOpen={(l) => setOpenId(l.id)} selectedKey={openId}
          empty="No loans. Add one with the button at the top." />
      )}
      {data && data.closed.length > 0 && (
        <details className="card-light group px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-secondary">Closed loans ({data.closed.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {data.closed.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setOpenId(l.id)} className="flex w-full justify-between gap-2 py-2.5 text-left text-sm hover:bg-paper-subtle">
                  <span className="text-ink-primary">{l.name}</span>
                  <span className="text-xs text-ink-muted">closed {month(l.closedMonth)} · {formatCurrency(l.principal)} borrowed</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <P2PSummaryCard />

      <DetailDrawer
        open={!!open}
        onClose={() => { setOpenId(null); setDialog(null); }}
        title={open?.name}
        subtitle={open ? `${open.loanType.toLowerCase()} loan${open.lender ? ` · ${open.lender}` : ''}${open.isActive ? '' : ` · closed ${month(open.closedMonth)}`}` : undefined}
      >
        {open && (
          <>
            {open.next && (
              <DrawerSection title={`This month · ${formatDate(`${open.next.period}-01`, 'MMM')}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-subtle px-3 py-2.5">
                  <span className="text-sm"><NextDueCell dueDate={open.next.dueDate} status={open.next.status} /> <b className="ml-1 tabular-nums">{formatCurrency(open.next.amount)}</b></span>
                  <PaymentActions row={open.next} planMonth={open.next.period} />
                </div>
                {open.autoDebit && <p className="mt-1 text-[11px] text-ink-muted">Auto-debited: marked paid on its due date. You can still undo it.</p>}
              </DrawerSection>
            )}
            <DrawerSection title="Repayment">
              <Facts items={[
                { label: 'EMI', value: formatCurrency(open.emi) },
                { label: 'Interest rate', value: `${open.interestRate}%` },
                { label: 'Left to repay', value: formatCurrency(open.left) },
                { label: 'Repaid so far', value: formatCurrency(open.amortisation.repaidSoFar) },
                { label: 'EMIs left', value: open.amortisation.monthsLeft ?? '—' },
                { label: 'Ends', value: month(open.amortisation.endsMonth) },
                { label: 'Interest still to pay', value: open.amortisation.interestLeft != null ? formatCurrency(open.amortisation.interestLeft) : '—' },
                { label: 'Who pays', value: `${who(open.payerMemberId)}${open.borrowerMemberId && open.borrowerMemberId !== open.payerMemberId ? ` (borrowed by ${who(open.borrowerMemberId)})` : ''}` },
              ]} />
              {open.amortisation.monthsLeft === null && open.isActive && <p className="mt-2 text-xs text-updown-down">The EMI doesn&apos;t cover the interest, so this loan never ends at this rate.</p>}
            </DrawerSection>
            {full && (
              <div className="flex flex-wrap gap-2">
                {open.isActive && <button type="button" className={btn} onClick={() => setDialog('prepay')}>Prepay / part-pay</button>}
                {open.isActive && <button type="button" className={btn} onClick={() => setDialog('rate')}>Change rate</button>}
                <button type="button" className={btn} onClick={() => setDialog('edit')}>Edit</button>
                <button type="button" className={`${btn} text-updown-down`} onClick={() => { if (window.confirm(`Delete ${open.name}? Its history goes too.`)) remove.mutate(open.id, { onSuccess: () => setOpenId(null) }); }}>Delete</button>
              </div>
            )}
            <DrawerSection title="History">
              <PaymentHistoryList type="LOAN" id={open.id} name={open.name} limit={24} />
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
      {full && dialog === 'prepay' && <PrepayLoanDialog loan={full} onClose={() => setDialog(null)} />}
      {full && dialog === 'rate' && <ChangeRateDialog loan={full} onClose={() => setDialog(null)} />}
      {full && dialog === 'edit' && <LoanForm loan={full} onClose={() => setDialog(null)} />}
    </RegisterPage>
  );
}
