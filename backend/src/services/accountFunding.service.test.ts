import { describe, it, expect } from 'vitest';
import { calculateAccountFunding, FundingAccount, FundingPayment } from './accountFunding.service';
const now = new Date('2026-10-05T08:00:00Z');
const account = (overrides: Partial<FundingAccount> = {}): FundingAccount => ({ id: 'a', name: 'Bank A', type: 'SAVINGS', balance: 12000, preferredMinimum: 30000, ...overrides });
const payment = (overrides: Partial<FundingPayment> = {}): FundingPayment => ({ id: 'p', type: 'BILL', name: 'Payment', amount: 27250, status: 'PENDING', dueDate: '2026-10-07', accountId: 'a', ...overrides });
const plan = (accounts = [account()], payments = [payment()], date = now, month = '2026-10') => calculateAccountFunding(accounts, payments, date, month);
describe('account funding calculations', () => {
  it('uses the higher of obligations and safety, never adds them together', () => {
    const result = plan();
    expect(result.accounts[0]).toMatchObject({ upcomingObligations: 27250, targetBalance: 30000, amountToAdd: 18000, surplus: 0, status: 'FUND_SOON', dueNext7Days: 27250 });
    expect(plan([account({ preferredMinimum: 5000 })]).accounts[0].targetBalance).toBe(27250);
  });
  it('does not net away shortages using money in another account', () => {
    const result = plan([account({ balance: 10000, preferredMinimum: 0 }), account({ id: 'b', balance: 20000, preferredMinimum: 5000 })], [payment({ amount: 18000 })]);
    expect(result.totals).toEqual({ required: 23000, available: 30000, toAllocate: 8000, surplus: 15000, unassigned: 0 });
    expect(result.transfers).toEqual([{ fromId: 'b', from: 'Bank A', toId: 'a', to: 'Bank A', amount: 8000 }]);
  });
  it('excludes paid/skipped/paused records and deduplicates occurrences', () => {
    const result = plan(undefined, [payment(), payment(), payment({ id: 'paid', status: 'PAID' }), payment({ id: 'skip', status: 'SKIPPED' }), payment({ id: 'paused', status: 'PAUSED' })]);
    expect(result.accounts[0].upcomingObligations).toBe(27250);
  });
  it('includes overdue and due today without rolling them into next month', () => {
    const result = plan(undefined, [payment({ dueDate: '2026-09-30', amount: 1000 }), payment({ dueDate: '2026-10-05', amount: 2000 })]);
    expect(result.accounts[0]).toMatchObject({ overdue: 1000, dueNext7Days: 2000, remainingThisMonth: 2000, upcomingObligations: 3000 });
    expect(result.accounts[0].nextPayment?.dueDate).toBe('2026-09-30');
    expect(result.next7Days).toHaveLength(1);
  });
  it('keeps unlinked, deleted, inactive and non-bank accounts visible as funding gaps', () => {
    const result = plan([account({ isActive: false }), account({ id: 'cash', type: 'CASH' })], [payment(), payment({ id: 'missing', accountId: null }), payment({ id: 'deleted', accountId: 'gone' })]);
    expect(result.accounts).toHaveLength(0);
    expect(result.unassigned).toHaveLength(3);
    expect(result.totals.unassigned).toBe(81750);
  });
  it('handles zero, negative, missing and non-finite balances safely', () => {
    for (const balance of [0, undefined, NaN, Infinity]) expect(plan([account({ balance })]).accounts[0].amountToAdd).toBe(30000);
    expect(plan([account({ balance: -500 })]).accounts[0].amountToAdd).toBe(30500);
    expect(plan(undefined, [payment({ amount: NaN }), payment({ amount: -10 })]).accounts[0].upcomingObligations).toBe(0);
  });
  it('handles all status branches including no-payment safety requirements', () => {
    expect(plan([account({ balance: 30000 })]).accounts[0].status).toBe('READY');
    expect(plan([account({ balance: 40000 })]).accounts[0].status).toBe('SURPLUS');
    expect(plan(undefined, [payment({ dueDate: '2026-10-20' })]).accounts[0].status).toBe('SHORT');
    expect(plan([account({ balance: 30000 })], []).accounts[0].status).toBe('NO_UPCOMING_PAYMENTS');
    expect(plan(undefined, []).accounts[0].status).toBe('SHORT');
    expect(plan([account({ balance: 0, preferredMinimum: 0 })], []).accounts[0].status).toBe('NO_UPCOMING_PAYMENTS');
  });
  it('extends funding targets across December and February month ends for imminent debits', () => {
    const result = plan([account({ preferredMinimum: 0 })], [payment({ dueDate: '2026-12-31', amount: 100 }), payment({ dueDate: '2027-01-02', amount: 200 }), payment({ dueDate: '2027-01-06', amount: 500 })], new Date('2026-12-30T00:00:00Z'), '2026-12');
    expect(result.accounts[0].targetBalance).toBe(300);
    expect(result.accounts[0].dueNext7Days).toBe(300);
    const feb = plan(undefined, [payment({ dueDate: '2028-02-29', amount: 10 }), payment({ dueDate: '2028-03-02', amount: 20 })], new Date('2028-02-28T00:00:00Z'), '2028-02');
    expect(feb.accounts[0].dueNext7Days).toBe(30);
  });
  it('rejects malformed dates without breaking other records and preserves cents', () => {
    const result = plan([account({ preferredMinimum: 0, balance: 0 })], [payment({ amount: 0.1 }), payment({ dueDate: '2026-10-08', amount: 0.2 }), payment({ dueDate: '2026-02-30' }), payment({ dueDate: 'bad' })]);
    expect(result.accounts[0].amountToAdd).toBe(0.3);
    expect(result.accounts[0].owner).toBe('Joint / unspecified');
  });
  it('never suggests more than available surplus and prioritizes earlier debits', () => {
    const result = plan([account({ balance: 0, preferredMinimum: 0 }), account({ id: 'b', balance: 0, preferredMinimum: 0 }), account({ id: 'c', balance: 500, preferredMinimum: 100 })], [payment({ amount: 300, dueDate: '2026-10-20' }), payment({ accountId: 'b', amount: 300, dueDate: '2026-10-06' })]);
    expect(result.transfers.map(t => [t.toId, t.amount])).toEqual([['b', 300], ['a', 100]]);
  });
});
