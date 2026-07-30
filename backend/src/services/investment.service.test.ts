import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as investmentService from './investment.service';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function setupUser() {
  const { user } = await authService.register({
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123',
  });
  return user.id;
}

// createInvestment's return type is loosely typed; narrow it here once
// rather than casting at every call site below.
async function createInv(...args: Parameters<typeof investmentService.createInvestment>) {
  const result = await investmentService.createInvestment(...args);
  return result as unknown as { id: string; address: string | null; ownershipPercent: number | null; expectedAppreciationRate: number | null };
}

describe('investment.service collateral overlay', () => {
  // Regression coverage for the collateral-field extraction: address /
  // ownershipPercent / expectedAppreciationRate used to be plain columns on
  // Investment, now they live in the InvestmentCollateral overlay table (see
  // lib/investmentCollateral.ts). The API response shape must stay identical
  // even though the storage moved.

  it('create: collateral fields are stored as one InvestmentCollateral row and returned on the investment', async () => {
    const userId = await setupUser();

    const inv = await createInv(userId, {
      assetName: 'Family Home', assetType: 'REAL_ESTATE', purchaseDate: '2020-01-01',
      quantity: 0, buyPrice: 5000000, currentPrice: 6000000,
      address: '123 Main St', ownershipPercent: 60, expectedAppreciationRate: 5,
    } as any);

    expect(inv.address).toBe('123 Main St');
    expect(inv.ownershipPercent).toBe(60);
    expect(inv.expectedAppreciationRate).toBe(5);

    const rows = await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe('123 Main St');
    expect(rows[0].ownershipPercent?.toNumber()).toBe(60);
  });

  it('create: an investment with no collateral fields creates no InvestmentCollateral row', async () => {
    const userId = await setupUser();

    const inv = await createInv(userId, {
      assetName: 'Reliance', assetType: 'STOCK', purchaseDate: '2024-01-01',
      quantity: 10, buyPrice: 2500, currentPrice: 2700,
    } as any);

    expect(inv.address).toBeNull();
    expect(inv.ownershipPercent).toBeNull();
    expect(inv.expectedAppreciationRate).toBeNull();
    expect(await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } })).toHaveLength(0);
  });

  it('update: setting one collateral field preserves the others already on the row', async () => {
    const userId = await setupUser();
    const inv = await createInv(userId, {
      assetName: 'Car', assetType: 'VEHICLE', purchaseDate: '2023-01-01',
      quantity: 0, buyPrice: 1200000, currentPrice: 900000,
      address: 'Garage', ownershipPercent: 100, expectedAppreciationRate: -10,
    } as any);

    const updated = await investmentService.updateInvestment(userId, inv.id, { ownershipPercent: 50 } as any) as any;
    expect(updated.ownershipPercent).toBe(50);
    expect(updated.address).toBe('Garage'); // untouched field preserved
    expect(updated.expectedAppreciationRate).toBe(-10); // untouched field preserved
  });

  it('update: clearing all 3 collateral fields removes the InvestmentCollateral row', async () => {
    const userId = await setupUser();
    const inv = await createInv(userId, {
      assetName: 'Plot', assetType: 'REAL_ESTATE', purchaseDate: '2022-01-01',
      quantity: 0, buyPrice: 2000000, currentPrice: 2500000,
      address: 'Plot 7', ownershipPercent: 100, expectedAppreciationRate: 3,
    } as any);
    expect(await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } })).toHaveLength(1);

    const cleared = await investmentService.updateInvestment(userId, inv.id, {
      address: null, ownershipPercent: null, expectedAppreciationRate: null,
    } as any) as any;
    expect(cleared.address).toBeNull();
    expect(cleared.ownershipPercent).toBeNull();
    expect(await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } })).toHaveLength(0);
  });

  it('delete: cascades removal of the InvestmentCollateral row', async () => {
    const userId = await setupUser();
    const inv = await createInv(userId, {
      assetName: 'Bike', assetType: 'VEHICLE', purchaseDate: '2021-01-01',
      quantity: 0, buyPrice: 150000, currentPrice: 90000,
      ownershipPercent: 100, expectedAppreciationRate: -15,
    } as any);
    expect(await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } })).toHaveLength(1);

    await investmentService.deleteInvestment(userId, inv.id);
    expect(await prisma.investmentCollateral.findMany({ where: { investmentId: inv.id } })).toHaveLength(0);
  });

  it('getPortfolioSummary: scales REAL_ESTATE invested/current value by ownershipPercent', async () => {
    const userId = await setupUser();
    await createInv(userId, {
      assetName: 'Co-owned Flat', assetType: 'REAL_ESTATE', purchaseDate: '2020-01-01',
      quantity: 0, buyPrice: 4000000, currentPrice: 5000000, ownershipPercent: 60,
    } as any);

    const summary = await investmentService.getPortfolioSummary(userId);
    expect(summary.portfolio[0].investedValue).toBeCloseTo(4000000 * 0.6, 2);
    expect(summary.portfolio[0].currentValue).toBeCloseTo(5000000 * 0.6, 2);
  });

  it('getPortfolioSummary: unset ownershipPercent defaults to 100% (pre-existing behavior preserved)', async () => {
    const userId = await setupUser();
    await createInv(userId, {
      assetName: 'Sole Flat', assetType: 'REAL_ESTATE', purchaseDate: '2020-01-01',
      quantity: 0, buyPrice: 3000000, currentPrice: 3500000,
    } as any);

    const summary = await investmentService.getPortfolioSummary(userId);
    expect(summary.portfolio[0].investedValue).toBeCloseTo(3000000, 2);
    expect(summary.portfolio[0].currentValue).toBeCloseTo(3500000, 2);
  });
});
