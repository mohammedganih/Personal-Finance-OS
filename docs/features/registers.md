# Registers and Spending

Round 4 of the [redesign plan](https://claude.ai/artifact/FFNbhYbvRGzk55zFTu9amx) ("Target layout", phase 4), built 2026-11-07 on branch `redesign/registers`.

Loans, Credit cards, Bills & subscriptions and Savings & investments are now plain registers. Each has a few key totals, a table, and a detail drawer with the schedule, history and the shared payment buttons. The building blocks live in `frontend/components/register/Register.tsx`.

The stats rows, donuts, gauges, insights cards and separate "upcoming" cards are gone from these pages. Their backend (debt strategy, prepayment, diversification, XIRR and the rest) stays, for the Health check page.

Each register is one read, `GET /api/v1/registers/<page>` (`backend/src/registers`). Its totals come from the metrics module and the schedule engine.

| Page | Totals | Table | Drawer |
|---|---|---|---|
| Loans | Total left (metrics), EMIs this month, debt-free month | Loan and who pays (and whose account it's debited from), EMI, left to repay, ends, next due with Paid / Auto-paid / Due / Overdue | This month's payment, repayment figures (EMIs left, interest still to pay), prepay, change rate, edit, delete, history. Closed loans are in a collapsed section; money lent and borrowed stays below. |
| Credit cards | Statement due and its date, building now, limit left | Card, who pays, statement due, building now, limit left | The existing statement logic: building now, entered statements with what's on them and Pay / Undo, the card's EMIs (moved here; Home still counts them under Loans & EMIs), card expenses, edit and delete |
| Bills & subscriptions | Bills a month, still due this month, yearly & quarterly costs with the monthly set-aside | One table with All / Subscriptions / Utilities / Yearly filters: bill, amount and frequency (bills due every 2+ months show "set aside ₹X/mo"), a month, next due, paid from | Next payment, details, edit, pause / resume, duplicate, delete, history |
| Savings & investments | Total value (metrics), added this month (SAVE flows), next maturity | Monthly instalments (this month's status), then all holdings: value and gain, put in, a month, matures | This month's payment, figures, maturity bonus, edit, pause or change amount, delete, contributions history |

## SIP and gold scheme values
This is plan bug 6, handled in `backend/src/schedule/paidIn.ts`.

**Invested** is what was actually paid in:
- A recorded instalment counts what was recorded; a skip counts nothing.
- Months before the app tracked the holding count the scheduled instalment, honouring pauses and amount changes.
- Months since tracking began with nothing recorded count nothing yet.

**Value:**
- A SIP's value stays units × NAV when both are typed.
- A gold scheme is valued at what was paid in, because its grams never change as instalments are paid. Its maturity amount, and any bonus over the instalments, are shown separately.

Net worth uses the same figures.

## Spending
Spending replaces Transactions and Budgets (`/spending`; `/transactions` and `/budgets` redirect there).
- **Header:** spent this month, a day, and the biggest category.
- **Category bar:** includes the per-category limits. A limit can be set, changed or removed inline.
- **Day-by-day list:** bank entries and card purchases together.
  - By default it shows everyday spending only.
  - A toggle adds transfers, saving, EMIs, income and the card bill.
  - The card bill is never counted as spending, because its purchases are listed one by one.

**One category list.** Bills and card purchases now carry a `categoryId` on the Category table, so Spending and the limits include card purchases. Migration `20261107000000_one_category_list` did this:
- Each free-text category was matched by name (ignoring case) or created.
- On the dev DB that created 8 categories and linked all 21 bills and 7 card purchases.

The old `category` text columns stay for now.

## Navigation
The sidebar has five groups:
- **This month:** Home, Spending
- **Commitments:** Loans, Credit cards, Bills & subscriptions
- **Wealth:** Savings & investments, Goals
- **Look back:** Analytics
- **Setup:** Accounts, Settings

The Reports placeholder is gone, and `/reports` redirects to Analytics.

## Not done yet
- The old dark Analytics page is still wider than a phone (425px at 390). It becomes Health check in the next round.
