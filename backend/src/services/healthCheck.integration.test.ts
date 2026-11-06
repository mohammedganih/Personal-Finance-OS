import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { bufferLevel, debtToIncomeLevel, getHealthCheck, missingStatements, savingsRateLevel, stalePrices } from './healthCheck.service';
import { createLoan } from './loan.service';
import { saveSalary } from './monthSummary.service';
import { updateInvestment } from './investment.service';
import { checkInBalances } from './netWorthPage.service';

const NOW = new Date('2026-11-06T06:00:00Z');
beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('health check', () => {
  it('levels', () => {
    expect([bufferLevel(100, 100), bufferLevel(60, 100), bufferLevel(40, 100), bufferLevel(0, 0)]).toEqual(['good', 'watch', 'act', 'good']);
    expect([debtToIncomeLevel(null), debtToIncomeLevel(30), debtToIncomeLevel(35), debtToIncomeLevel(45)]).toEqual(['good', 'good', 'watch', 'act']);
    expect([savingsRateLevel(25), savingsRateLevel(15), savingsRateLevel(5)]).toEqual(['good', 'watch', 'act']);
  });

  it('flags funds valued at paid in, values entered 60+ days ago, and old stock prices', () => {
    const old = new Date('2026-08-01T00:00:00Z');
    const rows = [
      { id: 'a', assetName: 'Old value', assetType: 'SIP', quantity: 10, enteredValue: 1000, priceUpdatedAt: old, updatedAt: NOW },
      { id: 'b', assetName: 'Fresh value', assetType: 'SIP', quantity: 10, enteredValue: 1000, priceUpdatedAt: new Date('2026-10-20'), updatedAt: NOW },
      { id: 'c', assetName: 'Paid in only', assetType: 'SIP', quantity: 0, enteredValue: null, priceUpdatedAt: old, updatedAt: old },
      { id: 'd', assetName: 'Lump sum', assetType: 'MUTUAL_FUND', quantity: 5, enteredValue: null, priceUpdatedAt: NOW, updatedAt: NOW },
      { id: 'e', assetName: 'FD', assetType: 'FIXED_DEPOSIT', quantity: 1, enteredValue: null, priceUpdatedAt: old, updatedAt: old },
      { id: 'f', assetName: 'Old share', assetType: 'STOCK', quantity: 3, enteredValue: null, priceUpdatedAt: old, updatedAt: old },
    ];
    const stale = stalePrices(rows, NOW);
    expect(stale.map((s) => s.name)).toEqual(['Paid in only', 'Lump sum', 'Old value', 'Old share']);
    expect(stale[0].detail).toMatch(/paid in/);
  });

  it('flags a card whose last statement date passed without a statement', () => {
    // Statement on the 2nd, due on the 20th: the 2 Nov statement is due 20 Nov.
    const card = { id: 'c1', cardName: 'Visa', statementDate: new Date('2026-07-02'), dueDate: new Date('2026-07-20') };
    expect(missingStatements([card], [], NOW).map((s) => s.detail)).toEqual(["The statement dated 2026-11-02 (due 2026-11-20) hasn't been entered."]);
    expect(missingStatements([card], [{ creditCardId: 'c1', month: '2026-11' }], NOW)).toEqual([]);
    expect(missingStatements([{ ...card, statementDate: null }], [], NOW)).toEqual([]);
  });

  it('puts buffer, debt to income, savings rate and stale data on one page', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'health@example.com', passwordHash: 'x' } });
    const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'A', isDefault: true } });
    const bank = await prisma.account.create({ data: { userId: user.id, memberId: a.id, name: 'Bank', type: 'SAVINGS', balance: 50000 } });
    await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: 100000, accountId: bank.id });
    await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 300000, interestRate: 9, emi: 35000, remainingBalance: 300000, tenureMonths: 10, startDate: '2026-01-05', autoDebit: false } as never);
    // Units and NAV typed long ago, but no value entered: valued at paid in.
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'Flexi SIP', assetType: 'SIP', quantity: 100, buyPrice: 10, currentPrice: 12, monthlyAmount: 1000, purchaseDate: new Date('2026-01-01'), priceUpdatedAt: new Date('2026-07-01') } });

    let h = await getHealthCheck(user.id);
    expect(h.debtToIncome).toMatchObject({ monthlyEmis: 35000, income: 100000, pct: 35, level: 'watch' });
    // 50,000 + the 1,00,000 salary against 36,000 a month of commitments.
    expect(h.buffer).toMatchObject({ monthlyCommitments: 36000, level: 'good' });
    expect(h.buffer.monthsCovered).toBeGreaterThan(3);
    expect(h.stale.map((s) => s.kind).sort()).toEqual(['BALANCES', 'MONTH_CLOSE', 'PRICE']);
    expect(h.advice.strategy?.order).toEqual(['Car']);

    // Entering the NAV and checking in the balances clears those flags.
    await updateInvestment(user.id, sip.id, { currentPrice: 13 } as never);
    await checkInBalances(user.id, [{ accountId: bank.id, balance: 150000 }]);
    h = await getHealthCheck(user.id);
    expect(h.stale.map((s) => s.kind)).toEqual(['MONTH_CLOSE']);
  });
});
