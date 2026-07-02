/**
 * Read-only diagnostic: compares each account's stored `balance` against the
 * sum of its linked transactions. Does NOT write anything.
 *
 * Why it can't auto-fix: Account.balance is also settable directly (opening
 * balance at creation, or an edit), so it isn't purely derived from
 * transactions. A mismatch here may be a real bug (pre-fix balance drift from
 * the transaction update/delete/pay-flow bug) or simply an opening balance
 * that predates the account's transaction history — only you can tell them
 * apart. Run with `npm run audit:balances --workspace=backend`.
 */
import { prisma } from '../lib/prisma';

async function main() {
  const accounts = await prisma.account.findMany({
    select: { id: true, name: true, balance: true, userId: true },
  });

  let mismatches = 0;

  for (const account of accounts) {
    const agg = await prisma.transaction.aggregate({
      where: { accountId: account.id, type: 'INCOME' },
      _sum: { amount: true },
    });
    const expenseAgg = await prisma.transaction.aggregate({
      where: { accountId: account.id, type: 'EXPENSE' },
      _sum: { amount: true },
    });

    const income = Number(agg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const txnNet = income - expense;
    const stored = Number(account.balance);
    const impliedOpening = stored - txnNet;

    console.log(`\nAccount: ${account.name} (${account.id})`);
    console.log(`  Stored balance:            ${stored.toFixed(2)}`);
    console.log(`  Net of linked transactions: ${txnNet.toFixed(2)}  (income ${income.toFixed(2)} - expense ${expense.toFixed(2)})`);
    console.log(`  Implied opening balance:   ${impliedOpening.toFixed(2)}  (stored - txn net)`);

    if (Math.abs(impliedOpening) > 0.01) {
      mismatches++;
      console.log(`  -> Non-zero implied opening balance. Legitimate if you funded this account before logging`);
      console.log(`     transactions in-app; otherwise this is drift from the pre-fix balance bug.`);
    }
  }

  console.log(`\n${accounts.length} account(s) checked, ${mismatches} with a non-zero implied opening balance.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
