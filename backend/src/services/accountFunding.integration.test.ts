import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getAccountFundingPlan } from './accountFunding.service';
import { decideMonthlyPayment, getMonthlyPlan } from './monthlyPayments.service';
import { payOccurrence } from './bill.service';
import { createCreditCard, updateCreditCard } from './credit-card.service';
beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T08:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());
async function setup() {
  const user = await prisma.user.create({ data: { name: 'Funding test', email: 'funding@example.com', passwordHash: 'test' } });
  const member = await prisma.familyMember.create({ data: { userId: user.id, name: 'Partner', relation: 'Spouse' } });
  const account = await prisma.account.create({ data: { userId: user.id, memberId: member.id, name: 'Test bank', type: 'SAVINGS', balance: 5000, preferredMinimum: 1000 } });
  return { user, account };
}
describe('funding plan from saved records', () => {
  it('links bills, includes prior arrears, ignores paid/paused and card charges', async () => {
    const { user, account } = await setup();
    const bill = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Monthly utility', amount: 1000, startDate: new Date('2026-08-07'), accountId: account.id } });
    await prisma.dueStatus.create({ data: { userId: user.id, itemType: 'BILL', itemId: bill.id, period: '2026-08', dueKey: '2026-08-07', dueDate: new Date('2026-08-07'), status: 'PAID', amount: 1000 } });
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Paused', amount: 900, status: 'PAUSED', startDate: new Date('2026-09-01'), accountId: account.id } });
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Test card', creditLimit: 10000, dueDate: new Date('2026-10-09'), outstanding: 500, bankAccountId: account.id } });
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Card subscription', amount: 200, startDate: new Date('2026-10-07'), creditCardId: card.id } });
    const result = await getAccountFundingPlan(user.id);
    expect(result.accounts[0]).toMatchObject({ owner: 'Partner', upcomingObligations: 2500, overdue: 1000, dueNext7Days: 1500 });
    expect(result.unassigned).toHaveLength(0);
    await payOccurrence(user.id, bill.id, { dueDate: '2026-10-07', createTransaction: true });
    expect((await getAccountFundingPlan(user.id)).accounts[0].upcomingObligations).toBe(1500);
  });
  it('uses configurable debit days and removes paid loans and inactive SIPs', async () => {
    const { user, account } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-09-30'), paymentDay: 7, bankAccountId: account.id } });
    await prisma.investment.create({ data: { userId: user.id, assetName: 'Paused SIP', assetType: 'SIP', purchaseDate: new Date('2026-09-01'), monthlyAmount: 3000, recurringActive: false, bankAccountId: account.id } });
    const result = await getAccountFundingPlan(user.id);
    expect(result.accounts[0]).toMatchObject({ upcomingObligations: 2000, dueNext7Days: 2000 });
    expect(result.accounts[0].nextPayment?.dueDate).toBe('2026-10-07');
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    expect((await getAccountFundingPlan(user.id)).accounts[0]).toMatchObject({ upcomingObligations: 0, currentBalance: 3000, targetBalance: 1000 });
    await prisma.loan.update({ where: { id: loan.id }, data: { paymentDay: 31 } });
    expect((await getMonthlyPlan(user.id, '2027-02')).rows.find(p => p.type === 'LOAN')?.dueDate).toBe('2027-02-28');
  });
  it('retains orphaned and inactive-account payments as visible gaps and isolates users', async () => {
    const { user, account } = await setup();
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Utility', amount: 1000, startDate: new Date('2026-10-07'), accountId: account.id } });
    await prisma.account.update({ where: { id: account.id }, data: { isActive: false } });
    expect((await getAccountFundingPlan(user.id)).totals.unassigned).toBe(1000);
    await prisma.account.delete({ where: { id: account.id } });
    expect((await getAccountFundingPlan(user.id)).unassigned[0].accountId).toBeNull();
    const other = await prisma.user.create({ data: { name: 'Other', email: 'funding-other@example.com', passwordHash: 'test' } });
    expect((await getAccountFundingPlan(other.id)).unassigned).toHaveLength(0);
    const foreign = await prisma.account.create({ data: { userId: other.id, name: 'Other bank', type: 'SAVINGS' } });
    await expect(createCreditCard(user.id, { cardName: 'Card', creditLimit: 10000, outstanding: 0, dueDate: '2026-10-09', bankAccountId: foreign.id })).rejects.toThrow('Active bank account not found');
    const card = await createCreditCard(user.id, { cardName: 'Card', creditLimit: 10000, outstanding: 0, dueDate: '2026-10-09' });
    await expect(updateCreditCard(user.id, card.id, { bankAccountId: foreign.id })).rejects.toThrow('Active bank account not found');
  });
});
