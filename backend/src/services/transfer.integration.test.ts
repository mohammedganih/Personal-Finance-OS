import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { createTransfer, deleteTransaction, updateTransaction } from './transaction.service';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'transfer@example.com', passwordHash: 'test' } });
  const hdfc = await prisma.account.create({ data: { userId: user.id, name: 'HDFC', type: 'SAVINGS', balance: 50000 } });
  const icici = await prisma.account.create({ data: { userId: user.id, name: 'ICICI', type: 'SAVINGS', balance: 1000 } });
  return { user, hdfc, icici };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);

describe('transfers between own accounts', () => {
  it('creates two TRANSFER legs with one group id and moves both balances', async () => {
    const { user, hdfc, icici } = await setup();
    const t = await createTransfer(user.id, { fromAccountId: hdfc.id, toAccountId: icici.id, amount: 20000, date: '2026-11-05', note: 'for the EMI' });

    const legs = await prisma.transaction.findMany({ where: { transferGroupId: t.transferGroupId }, orderBy: { type: 'asc' } });
    expect(legs.map((l) => [l.type, l.kind, l.accountId, Number(l.amount)])).toEqual([
      ['INCOME', 'TRANSFER', icici.id, 20000],
      ['EXPENSE', 'TRANSFER', hdfc.id, 20000],
    ]);
    expect(legs[0].description).toBe('Transfer from HDFC');
    expect(legs[1].notes).toBe('for the EMI');
    expect(await balance(hdfc.id)).toBe(30000);
    expect(await balance(icici.id)).toBe(21000);
  });

  it('deleting either leg removes both and puts the money back', async () => {
    const { user, hdfc, icici } = await setup();
    const t = await createTransfer(user.id, { fromAccountId: hdfc.id, toAccountId: icici.id, amount: 5000, date: '2026-11-05' });
    await deleteTransaction(user.id, t.legs[1].id);
    expect(await prisma.transaction.count({ where: { transferGroupId: t.transferGroupId } })).toBe(0);
    expect(await balance(hdfc.id)).toBe(50000);
    expect(await balance(icici.id)).toBe(1000);
  });

  it('lets the date and note change on both legs but refuses a new amount or account', async () => {
    const { user, hdfc, icici } = await setup();
    const t = await createTransfer(user.id, { fromAccountId: hdfc.id, toAccountId: icici.id, amount: 5000, date: '2026-11-05' });
    const out = t.legs[0];
    await updateTransaction(user.id, out.id, { date: '2026-11-06', notes: 'moved', amount: 5000, type: 'EXPENSE', accountId: hdfc.id });
    const legs = await prisma.transaction.findMany({ where: { transferGroupId: t.transferGroupId } });
    expect(legs.every((l) => l.notes === 'moved' && l.date.toISOString().startsWith('2026-11-06'))).toBe(true);

    await expect(updateTransaction(user.id, out.id, { amount: 6000 })).rejects.toMatchObject({ status: 400 });
    await expect(updateTransaction(user.id, out.id, { accountId: icici.id })).rejects.toMatchObject({ status: 400 });
    expect(await balance(hdfc.id)).toBe(45000);
  });

  it('refuses the same account twice and another household’s account', async () => {
    const { user, hdfc } = await setup();
    await expect(createTransfer(user.id, { fromAccountId: hdfc.id, toAccountId: hdfc.id, amount: 1, date: '2026-11-05' })).rejects.toMatchObject({ status: 400 });
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-t@example.com', passwordHash: 'x' } });
    const theirs = await prisma.account.create({ data: { userId: other.id, name: 'Theirs', type: 'SAVINGS', balance: 0 } });
    await expect(createTransfer(user.id, { fromAccountId: hdfc.id, toAccountId: theirs.id, amount: 100, date: '2026-11-05' })).rejects.toMatchObject({ status: 404 });
    expect(await balance(theirs.id)).toBe(0);
    expect(await balance(hdfc.id)).toBe(50000);
  });
});
