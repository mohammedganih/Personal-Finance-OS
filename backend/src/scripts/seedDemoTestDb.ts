/**
 * Seeds a demo household into the TEST database for visual checks of the UI.
 * Refuses to run unless DATABASE_URL points at a database whose name contains
 * "test" (the same guard as src/test/db.ts). Re-running replaces the demo user.
 *
 *   npx ts-node --transpile-only src/scripts/seedDemoTestDb.ts   (with backend/.env.test loaded)
 *
 * Demo login (test database only): demo@shazah.test / demo-pass-2026
 */
import '../lib/timezone';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

const EMAIL = 'demo@shazah.test';
const PASSWORD = 'demo-pass-2026';

async function main() {
  if (!/\/[^/?]*test[^/?]*(\?|$)/i.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to seed: DATABASE_URL is not a test database');
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const now = new Date();
  const ym = (offset: number) => { const d = new Date(now.getFullYear(), now.getMonth() + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const day = (offset: number, dd: number) => new Date(`${ym(offset)}-${String(dd).padStart(2, '0')}T00:00:00+05:30`);

  const user = await prisma.user.create({ data: { name: 'Demo Family', email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 12) } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Asha Rao', relation: 'Self', isDefault: true } });
  const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Ravi Rao', relation: 'Spouse', color: '#52514E' } });
  const bankA = await prisma.account.create({ data: { userId: user.id, name: 'Asha Savings', type: 'SAVINGS', balance: 60000, memberId: a.id, preferredMinimum: 5000 } });
  const bankB = await prisma.account.create({ data: { userId: user.id, name: 'Ravi Salary', type: 'SAVINGS', balance: 15000, memberId: b.id } });

  await prisma.monthlySalary.createMany({ data: [
    { userId: user.id, memberId: a.id, month: ym(0), amount: 140000 },
    { userId: user.id, memberId: b.id, month: ym(-1), amount: 74000 },
  ] });

  await prisma.loan.create({ data: { userId: user.id, name: 'Home loan', loanType: 'HOME', principal: 4000000, remainingBalance: 3240000, emi: 48874, tenureMonths: 240, interestRate: 8.5, startDate: day(-30, 5), paymentDay: 5, memberId: a.id, payerMemberId: a.id, bankAccountId: bankA.id } });
  const marriage = await prisma.loan.create({ data: { userId: user.id, name: 'Wedding loan', loanType: 'PERSONAL', principal: 500000, remainingBalance: 320000, emi: 19879, tenureMonths: 36, interestRate: 11, startDate: day(-14, 7), paymentDay: 7, memberId: a.id, payerMemberId: b.id, bankAccountId: bankA.id } });
  void marriage;

  const rd = await prisma.investment.create({ data: { userId: user.id, assetName: 'Bank RD', assetType: 'RECURRING_DEPOSIT', quantity: 8, purchaseDate: day(-8, 3), monthlyAmount: 30000, interestRate: 7, maturityDate: day(0, 28), maturityAmount: 372000, memberId: a.id, bankAccountId: bankA.id } });
  await prisma.ownershipSplit.create({ data: { userId: user.id, entityType: 'INVESTMENT', entityId: rd.id, secondaryMemberId: b.id, ratio: 50 } });
  await prisma.investment.create({ data: { userId: user.id, assetName: 'Flexi cap SIP', assetType: 'SIP', purchaseDate: day(-12, 10), monthlyAmount: 5000, memberId: b.id, bankAccountId: bankB.id } });

  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Rewards card', bank: 'Demo Bank', creditLimit: 300000, outstanding: 23450, statementDate: day(0, 1), dueDate: day(0, 18), memberId: a.id, bankAccountId: bankA.id } });
  await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Phone', totalAmount: 50400, emiAmount: 4200, tenureMonths: 12, emisPaid: 3, startDate: day(-4, 2), isNoCost: true, memberId: a.id } });

  const bill = (name: string, amount: number, dd: number, extra: object = {}) =>
    prisma.recurringBill.create({ data: { userId: user.id, name, amount, startDate: new Date(now.getFullYear() - 1, now.getMonth(), dd), memberId: a.id, accountId: bankA.id, ...extra } });
  await bill('Electricity', 2400, 12);
  await bill('Internet', 999, 3);
  await bill('Streaming', 649, 9, { accountId: null, creditCardId: card.id });
  const help = await bill('House help', 6000, 30, { memberId: b.id, accountId: bankB.id });
  await prisma.ownershipSplit.create({ data: { userId: user.id, entityType: 'BILL', entityId: help.id, secondaryMemberId: a.id, ratio: 50 } });
  console.log(`Seeded demo household for ${EMAIL}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
