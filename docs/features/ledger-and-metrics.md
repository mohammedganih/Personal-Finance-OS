# Ledger kinds, transfers, salary income and metrics

Foundation part 1 of the [redesign plan](https://claude.ai/artifact/FFNbhYbvRGzk55zFTu9amx), built 2026-11-06 on branch `redesign/foundation-1`.

## Ledger kinds
Every transaction now says what the money was for in `kind`: `INCOME`, `SPEND`, `TRANSFER`, `SAVE`, `DEBT` or `ADJUST`. `type` still says which way the account balance moved.

| Written by | kind | sourceType / sourceId | period |
|---|---|---|---|
| Month plan: loan EMI (interest and principal) | DEBT | `LOAN` / loan id | plan month |
| Month plan: SIP, RD, gold scheme | SAVE | `INVESTMENT` / investment id | plan month |
| One-off investment purchase | SAVE | `INVESTMENT` / investment id | month paid |
| Older pay-EMI endpoint | DEBT | `LOAN` / loan id | month paid |
| Loan prepayment | DEBT | `LOAN_EVENT` / loan event id | month paid |
| Bill payment | SPEND | `BILL` / bill id | due month |
| Card bill payment | SPEND | `CREDIT_CARD` / card id | statement month |
| Card purchase paid off from a bank | SPEND | `CARD_EXPENSE` / card expense id | statement month |
| Salary | INCOME | `SALARY` / monthly salary id | salary month |
| Transfer between own accounts | TRANSFER | (shared `transferGroupId`) | - |
| Typed by hand | INCOME or SPEND from its type | - | - |

A Prisma middleware (`backend/src/lib/prisma.ts`) fills a missing `kind` from `type`, so income written without one is never stored as SPEND.

**Backfill (dev DB).** Migration `20261106000000_transaction_kinds` classified the 147 existing rows:

| kind | rows |
|---|---|
| INCOME | 13 |
| SPEND | 81 |
| SAVE | 17 |
| DEBT | 36 |

It set the source fields on 72 of them, from `monthly_payments`, `bill_occurrences` and `card_expenses`. No `loan_events` had transactions. The rules:
- **SAVE:** anything linked to an investment payment or in the Investment category.
- **DEBT:** loan or card-EMI links, plus the Loan EMI, Card EMI and Wealth Creation categories.
- **SPEND:** everything else, including bills and the card bill.

## Transfers
- **Create:** `POST /api/v1/transactions/transfer` takes `{ fromAccountId, toAccountId, amount, date, note? }`.
  - It writes two TRANSFER legs with one `transferGroupId` and moves both balances.
  - In the Add Transaction dialog, use the **Transfer** option.
- **Delete:** deleting either leg deletes both and restores both balances.
- **Edit:** a leg's date, description and notes can change, and the date and notes apply to both legs. To change the amount or accounts, delete the transfer and add it again.

## Salary as income
- **Ledger entry:** saving a salary on Home (`PUT /dashboard/salary`) keeps one INCOME entry in step with it.
  - The entry credits the account the salary landed in (`monthly_salaries.accountId`).
  - Changing the amount or account moves the balances by the difference.
  - Setting the salary to 0 removes the entry.
- **Which account:**
  1. The `accountId` sent with the request.
  2. Otherwise, the account saved before for that salary.
  3. Otherwise, the person's first savings account.
- **Salary typed by hand:** if Salary income was already typed for that person and month, it is adopted rather than duplicated.
- **Dev DB:** migration `20261106010000_salary_account` linked the four saved salaries (Oct and Nov, both people) to their typed entries, without changing any amounts.
  - For October, the saved and typed amounts differ for both people.
  - The next save of either salary brings its entry and balance in line.

## Metrics (`backend/src/metrics`)
- **`getBalanceSheet`:** net worth.

  ```
  net worth = bank balances + investments + money lent
            − loans − card EMI outstanding − unpaid saved card statements − money borrowed
  ```

  - Credit-card accounts are left out of bank balances, because card debt comes from statements and EMIs.
  - An unpaid statement counts its total due minus the card-bill payments recorded for that month.
- **`getTotalDebt`:** the same liabilities. Home's net worth, its "Loans left to repay" tile and the debt overview all use it.
- **`getMonthFlows` / `getMonthFlowsRange`:**
  - Income, spend, save and debt per India-time month.
  - Transfers and adjustments are not counted.
  - `savingsRate = (income − spend − debt) / income`.
- **Where it is used:**
  - The dashboard overview, cash-flow trend and quick insights. Expenses there are now spend + debt, and saving is no longer an expense.
  - The debt overview total.
  - The analytics savings rate, through the overview.
- **Budgets:** count only SPEND.
- **Transfers left out:** the expense breakdown, spending rhythm, family stats, bill insights and the transaction summary.

## Migrations
- **Versioned migrations from now on.** Schema changes are Prisma migrations in `backend/prisma/migrations`.
  - `0_init` is the schema as it stood. It was marked applied on the dev and test DBs with `prisma migrate resolve --applied 0_init`.
  - The old SQL patches in `backend/prisma/patches` are part of that baseline.
- **Applying them elsewhere:** run `npm run prisma:deploy --workspace=backend`, then `npm run prisma:generate`.
- **Line endings:** migration files are kept LF by `.gitattributes`, because Prisma checksums them.

## Not done yet (next round)
The schedule engine, due status, auto-debit, a month-close snapshot, and the Net worth page.
