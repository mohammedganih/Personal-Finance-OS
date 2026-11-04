import { describe, it, expect } from 'vitest';
import { buildMonthSummary, pickSalary, shareRows } from './monthSummary.service';
import type { MonthlyPlanRow } from './monthlyPayments.service';

const members = [
  { id: 'm1', name: 'Mohammed Gani', color: null, emoji: null },
  { id: 'm2', name: 'Fathimah', color: '#52514E', emoji: null },
];
const row = (r: Partial<MonthlyPlanRow> & Pick<MonthlyPlanRow, 'id' | 'type' | 'amount'>): MonthlyPlanRow =>
  ({ name: r.id, status: 'PENDING', dueDate: '2026-11-10', ...r });

describe('month summary buckets', () => {
  it('works out left and free per person and combined', () => {
    const rows = [
      row({ id: 'home', type: 'LOAN', amount: 40000, memberId: 'm1', status: 'PAID', shared: true }),
      row({ id: 'sip', type: 'INVESTMENT', amount: 10000, memberId: 'm1' }),
      row({ id: 'power', type: 'BILL', amount: 2000, memberId: 'm1' }),
      row({ id: 'car', type: 'LOAN', amount: 15000, memberId: 'm2' }),
    ];
    const s = buildMonthSummary('2026-11', rows, members, [
      { memberId: 'm1', month: '2026-11', amount: 100000 },
      { memberId: 'm2', month: '2026-11', amount: 60000 },
    ]);
    const [a, b] = s.members;
    expect(a).toMatchObject({ salary: 100000, salaryIsEstimate: false, left: 48000, free: 48000, cardSpending: 0 });
    expect(a.loans).toMatchObject({ total: 40000, paid: 40000 });
    expect(a.loans.items[0]).toMatchObject({ id: 'home', shared: true, status: 'PAID' });
    expect(b).toMatchObject({ left: 45000, free: 45000 });
    expect(s.combined).toMatchObject({ salary: 160000, left: 93000, free: 93000 });
    expect(s.combined.loans).toMatchObject({ total: 55000, paid: 40000 });
    expect(s.unassigned).toEqual([]);
  });

  it('splits a card statement into EMIs, card bills and plain spending', () => {
    const rows = [
      row({ id: 'sbi', type: 'CREDIT_CARD', name: 'SBI - statement balance', amount: 23450, creditCardId: 'sbi', memberId: 'm1' }),
      row({ id: 'phone', type: 'CARD_EMI', amount: 4200, creditCardId: 'sbi', memberId: 'm1' }),
      row({ id: 'netflix', type: 'BILL', amount: 649, creditCardId: 'sbi', memberId: 'm2' }),
      row({ id: 'skipped', type: 'BILL', amount: 999, creditCardId: 'sbi', memberId: 'm1', status: 'SKIPPED' }),
    ];
    const s = buildMonthSummary('2026-11', rows, members, [{ memberId: 'm1', month: '2026-11', amount: 50000 }]);
    const [a, b] = s.members;
    expect(a.cards).toEqual([{ creditCardId: 'sbi', name: 'SBI', memberId: 'm1', dueDate: '2026-11-10', status: 'PENDING', statement: 23450, deducted: 4849, spending: 18601, needsStatementUpdate: false }]);
    expect(a.loans.total).toBe(4200); // card EMI counts as a loan
    expect(a.bills.total).toBe(0); // skipped bill is listed but not counted
    expect(a.bills.items).toHaveLength(1);
    expect(a).toMatchObject({ cardSpending: 18601, left: 45800, free: 27199 });
    // Card-charged bill stays in its payer's bills; card belongs to m1.
    expect(b.bills.total).toBe(649);
    expect(b.cards).toEqual([]);
    expect(s.combined.cardSpending).toBe(18601);
  });

  it('clamps card spending at zero and flags the statement for an update', () => {
    const rows = [
      row({ id: 'hdfc', type: 'CREDIT_CARD', amount: 1000, creditCardId: 'hdfc', memberId: 'm2' }),
      row({ id: 'tv', type: 'CARD_EMI', amount: 3000, creditCardId: 'hdfc', memberId: 'm2' }),
    ];
    const card = buildMonthSummary('2026-11', rows, members, []).members[1].cards[0];
    expect(card).toMatchObject({ statement: 1000, deducted: 3000, spending: 0, needsStatementUpdate: true });
  });

  it('pre-fills salary from the most recent earlier month as an estimate', () => {
    const records = [
      { memberId: 'm1', month: '2026-08', amount: 90000 },
      { memberId: 'm1', month: '2026-10', amount: 95000 },
      { memberId: 'm1', month: '2026-12', amount: 1 },
      { memberId: 'm2', month: '2026-11', amount: 60000 },
    ];
    expect(pickSalary(records, 'm1', '2026-11')).toEqual({ salary: 95000, salaryIsEstimate: true });
    expect(pickSalary(records, 'm2', '2026-11')).toEqual({ salary: 60000, salaryIsEstimate: false });
    expect(pickSalary(records, 'nobody', '2026-11')).toEqual({ salary: 0, salaryIsEstimate: false });
    const s = buildMonthSummary('2026-11', [], members, records);
    expect(s.members.map(m => m.salaryIsEstimate)).toEqual([true, false]);
    expect(s.combined.salary).toBe(155000);
  });

  it('lists rows with no person as unassigned but keeps them in combined', () => {
    const rows = [
      row({ id: 'gas', type: 'BILL', amount: 900, memberId: null }),
      row({ id: 'gone', type: 'INVESTMENT', amount: 500, memberId: 'deleted-member' }),
      row({ id: 'rent', type: 'BILL', amount: 20000, memberId: 'm1' }),
    ];
    const s = buildMonthSummary('2026-11', rows, members, []);
    expect(s.unassigned).toEqual([
      { id: 'gas', type: 'BILL', name: 'gas', amount: 900 },
      { id: 'gone', type: 'INVESTMENT', name: 'gone', amount: 500 },
    ]);
    expect(s.members[0].bills.total).toBe(20000);
    expect(s.combined.bills.total).toBe(20900);
    expect(s.combined.investments.total).toBe(500);
  });

  it('marks only loans flagged shared', () => {
    const rows = [
      row({ id: 'joint', type: 'LOAN', amount: 100, memberId: 'm1', shared: true }),
      row({ id: 'own', type: 'LOAN', amount: 100, memberId: 'm1', shared: false }),
      row({ id: 'sip', type: 'INVESTMENT', amount: 100, memberId: 'm1' }),
    ];
    const m = buildMonthSummary('2026-11', rows, members, []).members[0];
    expect(m.loans.items.map(i => [i.id, i.shared])).toEqual([['joint', true], ['own', false]]);
    expect(m.investments.items[0].shared).toBe(false);
  });
});

describe('ownership splits and debit account', () => {
  const split = (entityId: string, ratio = 50) => ({ entityType: 'INVESTMENT', entityId, secondaryMemberId: 'm2', ratio });

  it('splits an investment between both people and keeps combined whole', () => {
    const rows = [
      row({ id: 'rd', type: 'INVESTMENT', amount: 30000, memberId: 'm1', status: 'PAID' }),
      row({ id: 'gold', type: 'INVESTMENT', amount: 10000, memberId: 'm1' }),
      row({ id: 'sip', type: 'INVESTMENT', amount: 2500, memberId: 'm1' }),
    ];
    const s = buildMonthSummary('2026-11', rows, members, [], { splits: [split('rd'), split('gold')] });
    const [a, b] = s.members;
    expect(a.investments).toMatchObject({ total: 22500, paid: 15000 });
    expect(b.investments).toMatchObject({ total: 20000, paid: 15000 });
    expect(b.investments.items.find(i => i.id === 'rd')).toMatchObject({ amount: 15000, fullAmount: 30000, sharePct: 50, memberId: 'm2' });
    expect(a.investments.items.find(i => i.id === 'sip')).toMatchObject({ amount: 2500, fullAmount: null, sharePct: null });
    expect(s.combined.investments.total).toBe(42500);
    expect(s.combined.investments.items).toHaveLength(3);
  });

  it('uses the stored ratio and keeps shares summing to the full amount', () => {
    const out = shareRows([row({ id: 'x', type: 'INVESTMENT', amount: 1000.01, memberId: 'm1' })], [split('x', 70)]);
    expect(out.map(r => [r.memberId, r.amount, r.sharePct])).toEqual([['m1', 700.01, 70], ['m2', 300, 30]]);
  });

  it('ignores splits on other entity types, unowned rows, or to the same person', () => {
    const rows = [
      row({ id: 'loan', type: 'LOAN', amount: 100, memberId: 'm1' }),
      row({ id: 'orphan', type: 'INVESTMENT', amount: 100, memberId: null }),
      row({ id: 'self', type: 'INVESTMENT', amount: 100, memberId: 'm2' }),
    ];
    expect(shareRows(rows, [split('loan'), split('orphan'), split('self')])).toHaveLength(3);
  });

  it('notes when a payment is debited from another person\'s account', () => {
    const rows = [
      row({ id: 'marriage', type: 'LOAN', amount: 19879, memberId: 'm2', accountId: 'icici', shared: true }),
      row({ id: 'own', type: 'LOAN', amount: 500, memberId: 'm1', accountId: 'icici' }),
    ];
    const s = buildMonthSummary('2026-11', rows, members, [], { accountOwners: new Map([['icici', 'm1']]) });
    expect(s.members[1].loans.items[0]).toMatchObject({ id: 'marriage', debitedFromMemberId: 'm1', shared: true });
    expect(s.members[0].loans.items[0].debitedFromMemberId).toBeNull();
    // Split rows: only the share whose person does not own the account gets the note.
    const gold = buildMonthSummary('2026-11', [row({ id: 'gold', type: 'INVESTMENT', amount: 10000, memberId: 'm1', accountId: 'canara' })], members, [], {
      splits: [split('gold')], accountOwners: new Map([['canara', 'm2']]),
    });
    expect(gold.members.map(m => m.investments.items[0].debitedFromMemberId)).toEqual(['m2', null]);
  });
});
