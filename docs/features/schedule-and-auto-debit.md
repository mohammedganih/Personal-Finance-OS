# Schedule engine, due status and auto-debit

Foundation part 2 of the [redesign plan](https://claude.ai/artifact/FFNbhYbvRGzk55zFTu9amx), built 2026-11-06 on branch `redesign/foundation-2`.

## One schedule engine (`backend/src/schedule`)
`dueItems(userId, fromMonth, toMonth)` lists every instalment per month. Each item has:
- what it is: type (LOAN, CARD_EMI, INVESTMENT, BILL, CARD_STATEMENT), name, month (`period`) and due date
- the money: amount and whether the bank takes it itself (`autoDebit`)
- who pays: the payer and any split
- where it is paid from: the account or card
- what happened: status (PENDING, PAID, SKIPPED or AUTO), with the paid amount and date

These all read from it:
- Home: the month sheet and Still to pay
- the account funding plan
- the reminders bell
- the bills calendar
- the Loans upcoming list (`/debt/calendar`)
- the Investments upcoming list (`/investments/calendar`)

The separate EMI and investment calendar builders were deleted. The upcoming lists now skip what is already paid, so an EMI paid on Home no longer shows as due on Loans.

Bills are projected from each bill's rule by `lib/billSchedule` (pure date maths). `schedule/bills.ts` loads bills and their recorded statuses, and `bill.service` uses the same code.

## Progress from dates and payments
- **Card EMIs.** Instalment *k* is billed in the *k*-th month from the first due date, which comes from the start date and the card's statement and due days.
  - `emisPaid` is a cache of the instalments whose due date has passed. It is refreshed when EMIs are read, created, edited or ticked.
  - An EMI archives itself once every instalment is billed.
  - The form no longer asks how many EMIs are paid.
- **Loans.** `remainingBalance` = `openingBalance` − principal repaid through recorded EMIs and prepayments.
  - It is re-derived after every payment, undo, prepayment and prepayment undo.
  - Typing a new balance by hand resets the opening balance.
  - Migration `20261106020000_loan_opening_balance` backfilled the opening balance, so no balance changed.

## due_status
One table records how each scheduled instalment was settled. Migration `20261106030000_due_status` created it.
- **Columns:** `userId`, `itemType`, `itemId`, `period` (YYYY-MM), `status` (PAID, SKIPPED or AUTO), `amount`, `paidDate`, `accountId`, `transactionIds`, `notes`.
- **Bills** also keep `dueDate`, and their `dueKey` is the occurrence's day, because a weekly bill falls more than once a month. For everything else, `dueKey` is empty.
- **One-off investment purchases** use `itemType` INVESTMENT_PURCHASE with period ONCE.
- **Unique key:** `(userId, itemType, itemId, period, dueKey)`.

The migration copied every row from the dev DB: 21 rows from `monthly_payments` and 46 from `bill_occurrences`. The tests run the copy step too.

Everything that records or reads a payment now uses `due_status`: Mark paid, skip, card EMI ticks, card bill payments, bill pay / skip / undo, undo, payment history, card statements, net worth and the schedule engine.

**Removed in round 5:** `monthly_payments` and `bill_occurrences` were dropped (migration `20261107010000_drop_old_payment_tables`). `backend/src/scripts/normalizeBillDates.ts` already uses `due_status`.

## Auto-debit
- **The flag.** `autoDebit` is on for loans and card EMIs by default. For investments it is on for recurring deposits only. Bills already had it.
  - It can be changed on the loan, card EMI and investment forms ("Auto-debited").
- **What `autoConfirm` does** (`schedule/autoConfirm.ts`):
  - It marks this month's auto-debited items due on or before today as AUTO.
  - It writes the same ledger entries Mark paid would. Card EMIs and bills charged to a card move no money.
  - It never touches earlier months and is safe to run again.
- **When it runs:**
  - every day at 06:00 India time, via node-cron;
  - about 15 seconds after the backend starts, because a laptop backend is rarely running at 06:00;
  - on demand: `POST /api/v1/dashboard/auto-confirm` runs it for the signed-in household.
  - To switch it off, set `AUTO_DEBIT_JOB=off`. It is always off in tests.
- **How AUTO behaves:**
  - It counts as paid in the month plan and on the month sheet.
  - The UI shows it as "Auto-paid" with Undo.
  - Undo reverses it exactly like a payment.
  - Payment history lists it as Auto-paid.

## Migrations in this round
| Migration | What it does |
|---|---|
| `20261106020000_loan_opening_balance` | `loans.openingBalance`, backfilled |
| `20261106030000_due_status` | the `due_status` table, copied from the two old tables |
| `20261106040000_auto_debit` | `autoDebit` on loans, card EMIs and investments (on for RDs) |

To apply them elsewhere, run `npm run prisma:deploy --workspace=backend`, then `npm run prisma:generate`.
