import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ cards: vi.fn(), emis: vi.fn(), events: vi.fn() }));
vi.mock('../lib/prisma', () => ({ prisma: {
  loan: { findMany: vi.fn().mockResolvedValue([]) }, loanEvent: { findMany: vi.fn().mockResolvedValue([]) }, investment: { findMany: vi.fn().mockResolvedValue([]) },
  creditCard: { findMany: mocks.cards }, cardEMI: { findMany: mocks.emis }, cardStatement: { findMany: vi.fn().mockResolvedValue([]) }, monthlyPayment: { findMany: mocks.events },
  ownershipSplit: { findMany: vi.fn().mockResolvedValue([]) },
} }));
vi.mock('./bill.service', () => ({ getBillsCalendar: vi.fn().mockResolvedValue([]) }));
import { getMonthlyPlan } from './monthlyPayments.service';
const card = { id: 'card', isActive: true, cardName: 'Sapphiro', outstanding: 0, statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  mocks.cards.mockResolvedValue([card]); mocks.events.mockResolvedValue([]);
  mocks.emis.mockResolvedValue([
    { id: 'flight', itemName: 'Flight', startDate: new Date('2026-04-04'), emiAmount: 6554, tenureMonths: 9, emisPaid: 6, isArchived: false, creditCard: card },
    { id: 'mac', itemName: 'Macbook', startDate: new Date('2026-06-09'), emiAmount: 7093, tenureMonths: 24, emisPaid: 4, isArchived: false, creditCard: card },
    { id: 'lenses', itemName: 'Lenses', startDate: new Date('2026-09-20'), emiAmount: 7799, tenureMonths: 1, emisPaid: 0, isArchived: false, creditCard: card },
    { id: 'shop', itemName: 'Shopping', startDate: new Date('2026-09-19'), emiAmount: 2241, tenureMonths: 1, emisPaid: 0, isArchived: false, creditCard: card },
    { id: 'sub', itemName: 'Subscription', startDate: new Date('2026-09-19'), emiAmount: 1999, tenureMonths: 1, emisPaid: 0, isArchived: false, creditCard: card },
  ]);
});
import { afterEach } from 'vitest';
afterEach(() => vi.useRealTimers());
describe('monthly card forecast', () => {
  it('includes October single-payment purchases once and ongoing EMIs in November', async () => {
    const october = await getMonthlyPlan('user', '2026-10');
    const november = await getMonthlyPlan('user', '2026-11');
    expect(october.creditCards).toBe(25686);
    expect(october.remaining).toBe(25686);
    expect(october.rows.every(r => r.dueDate === '2026-10-29')).toBe(true);
    expect(november.creditCards).toBe(13647);
    expect(november.rows).toHaveLength(2);
  });
  it('places a full statement balance in its due month, without repeating unknown spending', async () => {
    mocks.cards.mockResolvedValue([{ ...card, outstanding: 4000, dueDate: new Date('2026-11-29') }]);
    expect((await getMonthlyPlan('user', '2026-10')).rows.filter(r => r.type === 'CREDIT_CARD')).toHaveLength(0);
    expect((await getMonthlyPlan('user', '2026-11')).creditCards).toBe(17647);
    expect((await getMonthlyPlan('user', '2026-12')).rows.filter(r => r.type === 'CREDIT_CARD')).toHaveLength(0);
  });
  it('shows paid final installments while removing them from remaining cash required', async () => {
    const rows = await mocks.emis();
    rows[2].emisPaid = 1; rows[2].isArchived = true;
    mocks.events.mockResolvedValue([{ entityType: 'CARD_EMI', entityId: 'lenses', month: '2026-10', status: 'PAID', amount: 7799 }]);
    const plan = await getMonthlyPlan('user', '2026-10');
    expect(plan.paid).toBe(7799);
    expect(plan.creditCards).toBe(17887);
  });
  it('reduces cash required when an outstanding statement is partially paid', async () => {
    mocks.cards.mockResolvedValue([{ ...card, outstanding: 1500 }]);
    expect((await getMonthlyPlan('user', '2026-10')).creditCards).toBe(27186);
  });
});
