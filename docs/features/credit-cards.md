# Credit Cards page

Credit cards now have their own page, **Credit Cards** (`/credit-cards`), split out of "Loans & Cards". The Loans page (`/loans`) shows loans only.

## What it does
- **Statements:** one record per card per month. Each record holds the billing period, statement date, due date, total due, minimum due and status (Due, Part paid, Paid, or Overdue once the due date passes). It also shows what was paid, when and from which account, and keeps the history of earlier statements.
  - Pay and Undo use the shared `PaymentActions` control, so they behave the same as everywhere else. The ⋯ menu has Paid from, Amount and Paid on.
  - **What's on it** breaks a statement down into card EMIs, card expenses, bills charged to the card, and other charges. Other = total − listed items, for example interest, GST or purchases not entered.
- **Building now:** the statement that is still open, added up from the EMIs, card expenses and card bills entered so far. Nothing is guessed. "Statement arrived? Enter it" opens the statement form with its dates already filled in.
- **Card expenses:** a one-off purchase on a card that is not an EMI. It has a name, amount, date, category and person, and lands on the statement for the period it falls in.
  - Tick "I've already paid this off" (or press "Paid off" later) when you cleared it from a bank account in the same month. That records one expense and debits the bank. The purchase then no longer counts towards the statement. Undo reverses it.
- **Home:** card spending comes from the saved statement for the month: statement − card EMIs − card bills − purchases already counted elsewhere (for example a gold scheme instalment paid on the card). With no statement saved yet, it is the card expenses entered for that statement. Purchases paid off straight away that month are added on top. If there are neither, it falls back to the balance typed on the card, as before.

## Data
New tables, applied by `backend/prisma/patches/credit-cards.sql` (additive and idempotent; applied to the dev and test DBs on this machine):
- `card_statements`: unique per card + due month (`month`, YYYY-MM).
  - Payments are not stored here. They live on the card's `CARD_STATEMENT` row in `due_status` for that month, which is why Pay, Undo and payment history work unchanged.
  - The card's own fields (outstanding, minimum, due date, statement date) are synced from the latest saved statement, unless the card already holds a newer month's figure.
- `card_expenses`: `statementMonth` is worked out from the date. A saved statement whose period holds the date wins; otherwise the card's cycle decides. It can also be picked explicitly.
  - `linkedType`/`linkedId` mark a purchase that is already counted in another bucket.
  - `paidDate`/`paidFromAccountId`/`transactionId` are set when it was paid off straight away.

To apply the patch on another install, run from `backend/`:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/patches/credit-cards.sql
```

Then run `npm run prisma:generate` from the root.

## API (under `/api/v1/credit-cards`)
- `GET /:id/statements` returns the saved statements and the statement building now.
- `POST /:id/statements` saves a statement and replaces the one for the same due month.
- `DELETE /statements/:statementId` deletes a statement, but only when it has no payments.
- `POST /:id/pay` takes `{ amount, accountId?, month?, paidDate? }`. With a saved statement, the payment is capped at what is still owed on it.
- `GET /expenses?cardId=&month=`, `POST /expenses` (optional `payNow`), `PUT /expenses/:id`, `DELETE /expenses/:id`.
- `POST /expenses/:id/pay`, `POST /expenses/:id/undo-pay`.

The zod schemas are in `packages/shared/src/schemas/card-statement.schema.ts`.

## Data clean-up on the dev DB (2026-11-04)
A backup was taken first: `D:\Projects\shazah-backups\shazah_finance-before-credit-cards-2026-11-04.dump` (pg_dump, custom format).
- **ICICI CC account removed.** It was a duplicate (credit-card account, −₹4,240). Its only 2 transactions were the November ChatGPT ₹1,999 and Smart Bazaar ₹2,241 EMI ticks. Both were deleted with it.
- **Malabar Gold Scheme.**
  - The October payment from HDFC Zahra (recorded 4 Nov) and the November payment (1 Nov) were reversed and deleted, together with the split on the October transaction.
  - HDFC Zahra went from ₹3,126 to ₹23,126.
  - October is now marked paid with no bank debit, because it was charged to the card. It is entered as a card expense linked to the scheme, so Home does not count it twice.
  - The scheme itself is unchanged: ₹10,000 a month from HDFC Zahra, 50/50 with Fathimah, matures 5 Jan 2027.
- **1-month "EMIs" removed.** Lenskart, Smart Bazaar and ChatGPT, plus their 3 November paid records.
- **Card expenses entered on the 12 Sep – 11 Oct statement:**

  | Date | Purchase | Amount |
  |---|---|---|
  | 11 Sep | BookMyShow | ₹225.52 |
  | 19 Sep | Cloudflare (incl. DCC fee + GST) | ₹1,315.05 |
  | 19 Sep | Smart Bazaar | ₹2,241.11 |
  | 19 Sep | ChatGPT | ₹1,999.00 |
  | 20 Sep | Lenskart (Navalur) | ₹7,799.00 |
  | 10 Oct | Malabar Gold Scheme | ₹10,000.00 |

  BookMyShow (11 Sep) was pinned to this statement, as the bank listed it there.
- **Statement 12 Sep – 11 Oct 2026.** Total ₹37,548.11, minimum ₹15,280, due 29 Oct.
  - Marked paid in full on 16 Oct. As asked, the ICICI balance was not changed (it stays ₹30,861).
  - The payment transaction therefore has no account set (its note says it was paid from ICICI). Undo cannot add money back to ICICI that was never taken out.
- **Left alone:**
  - The Flight Tickets (7/9 paid) and Macbook (5/24 paid) EMIs, and their November ticks.
  - The card's own November figure (₹16,500, minimum ₹13,647, due 29 Nov). The November statement has not been issued yet; enter it when it arrives.

## Tests
- `cardStatement.service.test.ts`: cycle maths, purchase placement, EMIs on a statement, status, Home card spending.
- `cardStatements.integration.test.ts`: save and replace, part payment then full payment with the cap, undo, card sync, breakdown, card expenses paid off and undone, linked purchases on Home, other households.

The full backend suite passes (34 files, 337 tests), as do the shared, backend and frontend typechecks and frontend lint.

## Follow-up: live statement figure (2026-11-04)
- **Top of the Credit Cards page:**
  - Shows **Current statement**: the statement building now (EMIs + card expenses + card bills for the open period), due on its due date.
  - Once a statement is entered and still not fully paid, it switches to **Statement due** (what is left to pay on it).
- **Footer removed:** the "Credit card payments" list (with the "Sapphiro – statement balance" row) no longer appears on the page.
- **Home:** when a card has no statement row this month, its card line is "<card> statement so far" = this month's EMIs and card bills on the card + card expenses entered, with the EMIs/bills deducted as before. The "Update the statement" link now goes to Credit Cards.
- **Data (dev DB):** the placeholder figure typed on the Sapphiro card was cleared:
  - outstanding ₹16,500 → ₹0
  - minimum ₹13,647 → empty
  - due date (29 Nov) and statement date (11 Nov) unchanged

  So no "statement balance ₹16,500" row shows on Home, Still to pay or the funding plan. To restore it, set outstanding back to 16500 and minimum back to 13647 on that card.
