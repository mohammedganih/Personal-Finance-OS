'use client';

import { useMemo, useState } from 'react';
import { Receipt, Search, X } from 'lucide-react';
import { BILL_CATEGORIES } from '@shazah/shared';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { BillCard } from '@/components/bills/BillCard';
import { useBills, useBulkBillAction } from '@/hooks/useBills';
import { BILL_FREQUENCY_LABELS } from '@/lib/constants';
import { BillFrequency, BillStatus, RecurringBill } from '@/types';
import { cn } from '@/lib/utils';

const ALL = 'all';

export function BillsListTab({ onEdit, onAdd }: { onEdit: (bill: RecurringBill) => void; onAdd: () => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [frequency, setFrequency] = useState(ALL);
  const [status, setStatus] = useState(ALL); // all = every non-archived
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      search: search || undefined,
      category: category === ALL ? undefined : category,
      frequency: frequency === ALL ? undefined : (frequency as BillFrequency),
      status: status === ALL ? undefined : (status as BillStatus),
    }),
    [search, category, frequency, status]
  );

  const { data: bills, isLoading } = useBills(filters);
  const { mutate: bulkAction, isPending: isBulkPending } = useBulkBillAction();

  // Custom categories the user has actually used belong in the filter too.
  const categories = useMemo(() => {
    const set = new Set<string>(BILL_CATEGORIES);
    for (const bill of bills ?? []) set.add(bill.category);
    return Array.from(set);
  }, [bills]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: string, extra: Record<string, unknown> = {}) {
    bulkAction(
      { ids: Array.from(selectedIds), action, ...extra },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  }

  const allSelected = (bills ?? []).length > 0 && selectedIds.size === (bills ?? []).length;

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search name, vendor, category, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All frequencies</SelectItem>
            {Object.entries(BILL_FREQUENCY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Active + Paused</SelectItem>
            <SelectItem value="ACTIVE">Active only</SelectItem>
            <SelectItem value="PAUSED">Paused only</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {(bills ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedIds(allSelected ? new Set() : new Set((bills ?? []).map((b) => b.id)))}
              className="accent-[#9085e9]"
            />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </label>
          {selectedIds.size > 0 && (
            <div className={cn('flex flex-wrap items-center gap-1.5', isBulkPending && 'opacity-50 pointer-events-none')}>
              <BulkButton onClick={() => runBulk('archive')}>Archive</BulkButton>
              <BulkButton onClick={() => runBulk('restore')}>Restore</BulkButton>
              <BulkButton onClick={() => runBulk('pause')}>Pause</BulkButton>
              <BulkButton onClick={() => runBulk('resume')}>Resume</BulkButton>
              <Select onValueChange={(v) => runBulk('setCategory', { category: v })}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Set category…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => runBulk('setFrequency', { frequency: v })}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Set frequency…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILL_FREQUENCY_LABELS)
                    .filter(([k]) => k !== 'CUSTOM')
                    .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <BulkButton onClick={() => runBulk('delete')} danger>Delete</BulkButton>
            </div>
          )}
        </div>
      )}

      {/* Bill cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-28 shimmer" />)
        ) : (bills ?? []).length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Receipt}
              title={search || category !== ALL || frequency !== ALL || status !== ALL ? 'No bills match these filters' : 'No recurring bills yet'}
              description="Track subscriptions, utilities, insurance, rent, fees — every recurring commitment in one place"
              action={{ label: 'Add Bill', onClick: onAdd }}
            />
          </div>
        ) : (
          (bills ?? []).map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onEdit={onEdit}
              selectable
              selected={selectedIds.has(bill.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BulkButton({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
        danger
          ? 'bg-danger/10 text-danger hover:bg-danger/20'
          : 'bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-overlay'
      )}
    >
      {children}
    </button>
  );
}
