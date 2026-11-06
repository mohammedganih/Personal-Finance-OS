# Home v2

Round 3 of the [redesign plan](https://claude.ai/artifact/FFNbhYbvRGzk55zFTu9amx) ("Home, re-specified"), built 2026-11-06 on branch `redesign/home-v2`.

## The month sheet
Each card (each person, and Combined) now ends where the paper flow does:

1. Salary, minus Loans & EMIs, Investments and Bills, gives **Left for the month**.
2. Minus last month's card spending gives **Free to spend & buffer**.
3. Minus **Spent so far** gives **Still free**.

The thin bar under Still free compares the share of Free already spent with how far the month has gone.

**Spent so far** (`services/spentSoFar.service.ts`) is everyday spending this month that the lines above don't already count:
- SPEND entries in the ledger, except bill payments, card-bill payments and card purchases paid off straight away. Those are already in Bills and card spending.
- Card purchases made this month that land on a later statement, unless they are linked to another bucket or already paid off.

Shared spending is split by its OwnershipSplit. The line opens to list the entries and links to Transactions.

**Expected salary:** when a month's salary isn't entered, last month's is shown as *Salary expected* (grey, italic), with a one-click **Confirm**. While a salary is expected, Left, Free and Still free carry "if salary arrives as expected".

## Where we stand
This card replaces the old wealth strip (`GET /dashboard/where-we-stand`). Each row opens its page.
- **Net worth**, with the change since the last month close (marked approx. when that close was worked out after the fact).
- **Buffer** against its target, with a progress bar and an inline editor.
- **Debt left**, and the month the last loan or card EMI ends.
- **Goals on track.**

The buffer (`services/buffer.service.ts`):
- **What it counts:** the balance of the buffer accounts, less this month's payments still due from them.
- **Settings:** stored in `user_settings`.
  - The buffer accounts default to every active savings account.
  - The target defaults to 3 × the month's commitments (loans, EMIs, investments and bills).
- **API:** `GET /dashboard/buffer` and `PUT /dashboard/settings/buffer`.

## Month close
`month_close` keeps each month's sheet totals (per person and combined), net worth, total debt and bank balances at month end.
- **How month-end figures are worked out:** today's figures are rolled back through the ledger. Bank entries after month end are undone, and loan principal repaid after it is added back.
- **When a month is closed:** the daily job (`jobs/daily.job.ts`, which also runs auto-debit) closes last month if it isn't closed yet. On the 1st, that is the month just ended.
- **Older months:** `npm run close:backfill --workspace=backend` closes every earlier month, marked approximate. On the dev DB this created June to October 2026 for both households.
- **Net worth snapshots:** they are no longer written each time the overview is read. The table stays.

## Quick add
The **+** button on every dashboard page logs a spend in a few taps: amount, what, category, who, and paid from.
- Paid from a bank account: it is recorded as everyday spending.
- Paid on a card: it is added as a card purchase on that card's statement.

## Phone width
Below the `lg` breakpoint the sidebar becomes a drawer, opened from the header's menu button. Home and the other dashboard pages work at 390px wide without sideways scrolling.

## Migrations
- `20261106050000_user_settings`
- `20261106060000_month_close`
