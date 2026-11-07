'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Plus, ArrowUpDown, Check, Search } from 'lucide-react';
import { useAccounts, useDeleteAccount } from '@/hooks/useAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { useLoans } from '@/hooks/useLoans';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { buildLedger, LEDGER_BUCKETS, LedgerRow } from '@/lib/accountLedger';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AccountForm } from '@/components/settings/AccountSetup';
import { Account } from '@/types';

const TABS = ['All', ...LEDGER_BUCKETS] as const;
type Tab = (typeof TABS)[number];

type SortKey = 'balance' | 'name';
const SORT_LABEL: Record<SortKey, string> = { balance: 'Balance (High to Low)', name: 'Name (A to Z)' };

const MANAGE_HREF: Record<LedgerRow['sourceType'], string | null> = {
  account: null, creditCard: '/loans', investment: '/investments', loan: '/loans',
};

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="min-w-40 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
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

function LedgerTableRow({ row, onEdit, onDelete }: { row: LedgerRow; onEdit: (a: Account) => void; onDelete: (id: string) => void }) {
  const Icon = row.icon;
  const manageHref = MANAGE_HREF[row.sourceType];

  return (
    <tr>
      <td className="px-1 py-3.5">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${row.color}1F`, color: row.color }}>
            <Icon className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <p className="text-sm font-medium text-ink-primary truncate">{row.name}</p>
            <p className="text-xs text-ink-muted truncate">{row.maskedNumber ?? row.typeLabel}</p>
          </span>
        </div>
      </td>
      <td className="hidden sm:table-cell px-1 py-3.5 whitespace-nowrap">
        <span className="inline-flex items-center rounded-full bg-paper-subtle px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
          {row.bucket}
        </span>
      </td>
      <td className="hidden sm:table-cell px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary truncate">{row.institution ?? '—'}</p>
      </td>
      <td className="px-1 py-3.5 text-right whitespace-nowrap">
        <p className={cn('text-sm font-semibold tabular-nums', row.isLiability ? 'text-updown-down' : 'text-updown-up')}>
          {row.isLiability ? '-' : ''}{formatCurrency(row.balance, 'INR', true)}
        </p>
        <p className="text-xs text-ink-muted">{row.balanceLabel}</p>
      </td>
      <td className="hidden sm:table-cell px-1 py-3.5 whitespace-nowrap">
        {row.member ? (
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: row.member.color ?? '#8b8fa3' }}
            title={row.member.name}
          >
            {row.member.emoji ?? '👤'}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </td>
      <td className="px-1 py-3.5 text-right">
        {row.sourceType === 'account' && row.account ? (
          <RowMenu>
            <MenuItem onSelect={() => onEdit(row.account!)}>Edit</MenuItem>
            <MenuItem danger onSelect={() => onDelete(row.account!.id)}>Delete</MenuItem>
          </RowMenu>
        ) : manageHref ? (
          <Link href={manageHref} className="text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors whitespace-nowrap">
            Manage →
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Unifies Account/CreditCard/Investment/Loan into one ledger (see
 * lib/accountLedger.ts) -- the reference's "All Accounts" spans all four,
 * matching what Account Breakdown already sums. Only Account rows get
 * inline Edit/Delete here; the other three already have fuller management
 * on their own dedicated pages, so their row action links there instead of
 * re-implementing three more forms in this overview table.
 */
export function AllAccountsTable() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: creditCards, isLoading: cardsLoading } = useCreditCards();
  const { data: summary, isLoading: investmentsLoading } = usePortfolioSummary();
  const { data: loans, isLoading: loansLoading } = useLoans();
  const { data: members } = useFamilyMembers();
  const { mutate: deleteAccount } = useDeleteAccount();

  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const isLoading = accountsLoading || cardsLoading || investmentsLoading || loansLoading;

  const membersById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);

  const ledger = useMemo(() => buildLedger({
    accounts: accounts ?? [],
    creditCards: creditCards ?? [],
    investments: summary?.portfolio ?? [],
    loans: loans ?? [],
    membersById,
  }), [accounts, creditCards, summary, loans, membersById]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { All: ledger.length, Bank: 0, 'Credit Card': 0, Investment: 0, Loan: 0, Cash: 0 };
    for (const r of ledger) c[r.bucket]++;
    return c;
  }, [ledger]);

  const filtered = useMemo(() => {
    let list = tab === 'All' ? ledger : ledger.filter((r) => r.bucket === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.institution?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => (sortKey === 'name' ? a.name.localeCompare(b.name) : b.balance - a.balance));
  }, [ledger, tab, search, sortKey]);

  const openEdit = (account: Account) => { setEditingAccount(account); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingAccount(null); };

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-ink-primary">All Accounts</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
            <input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 pl-8 pr-3 rounded-full border border-line bg-paper-card text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-line-strong"
            />
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 rounded-full border border-line bg-paper-card px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-line-strong transition-colors whitespace-nowrap">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort: {SORT_LABEL[sortKey]}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="min-w-48 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={() => setSortKey(key)}
                    className="px-3.5 py-2 text-xs font-medium cursor-pointer outline-none flex items-center justify-between text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary transition-colors"
                  >
                    {SORT_LABEL[key]}
                    {sortKey === key && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5 flex-wrap mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', tab === t ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
          >
            {t} {counts[t] > 0 && `(${counts[t]})`}
          </button>
        ))}
      </div>

      {ledger.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-ink-muted">No accounts yet</p>
          <p className="text-xs text-ink-muted">Add your bank accounts, wallets, and credit cards</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No accounts in this view</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full sm:min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Account</th>
                <th className="hidden sm:table-cell text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Type</th>
                <th className="hidden sm:table-cell text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Institution</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Balance</th>
                <th className="hidden sm:table-cell text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Linked To</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((row) => (
                <LedgerTableRow key={row.id} row={row} onEdit={openEdit} onDelete={deleteAccount} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Account
      </button>

      {showForm && <AccountForm account={editingAccount ?? undefined} onClose={closeForm} />}
    </div>
  );
}
