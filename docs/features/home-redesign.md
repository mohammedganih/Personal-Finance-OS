# Home page redesign

Built from `docs/design/home-redesign-spec.md`, with `docs/design/home-redesign-mockup.html` as the visual reference.

The home page (`/dashboard`) now reads like the family's paper sheet. Each family member gets a card: salary received, minus loans & EMIs, minus investments, minus bills, gives **left for the month**; minus last month's card spending gives **free to spend & buffer**. A Combined card shows the whole household. Under that are **Still to pay** (pending payments this month, with Mark paid) and **Our wealth** (four compact tiles).

## What changed

### Backend
- `prisma/schema.prisma`: new `MonthlySalary` model (`monthly_salaries`), unique per user + member + month, with back-relations on `User` and `FamilyMember`.
- `prisma/patches/monthly-salary.sql` (new): additive, idempotent patch for existing installs. It creates the table, the unique index and two FKs (`ON DELETE CASCADE`). It changes nothing else.
- `src/services/monthlyPayments.service.ts`: each `getMonthlyPlan` row now also carries `memberId` (who pays), `shared` (loans only) and, for bills and card statements, `creditCardId`. No existing fields changed.
  - LOAN → `payerMemberId ?? memberId`. `shared` is true when borrower and payer differ or either is unset.
  - INVESTMENT → `memberId`. CREDIT_CARD → card `memberId`. CARD_EMI → `emi.memberId ?? card.memberId`.
  - BILL → bill `memberId`, or the card owner when the bill is charged to a card and has no person.
- `src/services/bill.service.ts`: `getBillsCalendar` rows now include `memberId` (it already had `creditCardId`).
- `src/services/monthSummary.service.ts` (new): the bucket maths (`buildMonthSummary`, pure) plus `getMonthSummary` and `saveSalary`.
- `src/routes/dashboard.routes.ts`: `GET /dashboard/month-summary?month=YYYY-MM` (defaults to the current month) and `PUT /dashboard/salary` (`{ memberId, month, amount, note? }`, zod-validated; the member must belong to the user, otherwise 404).
- Tests: `monthSummary.service.test.ts` (card split, clamp to 0, salary pre-fill, unassigned rows, shared flag) and `monthSummary.integration.test.ts` (who-pays resolution from real records, shared loans, salary upsert and ownership check).

### Frontend
- `hooks/useMonthSummary.ts` (new): `useMonthSummary(month)`, `usePeriodMonth()` (the header period selector as `YYYY-MM`) and `useSaveSalary()` (invalidates `dashboard` queries).
- `components/dashboard/home/MonthSheet.tsx` (new): per-member cards plus Combined. Inline salary editing saves on blur or Enter; Enter on an estimate confirms it. Lines expand to show each item with a paid tick, a `shared` tag, and "₹X of ₹Y paid". The card-spending step is amber, Free to spend is green (red when negative), and a thin stacked bar sits at the bottom. "N items have no person set" expands to "Set who pays" links. Layout: 3 columns at `xl`, 1 below.
- `components/dashboard/home/StillToPay.tsx` (new): pending rows for the current month, sorted by date, showing "<person> pays" and Mark paid. It uses the existing calls: `POST /dashboard/monthly-payment` (loans, investments), `POST /card-emis/:id/pay` (card EMIs) and `usePayBillOccurrence` (bills). Card statements link to `/loans`. Amber "Move ₹X to <account> before <date>" lines come from `useAccountFunding()` for accounts with `amountToAdd > 0`.
- `components/dashboard/home/WealthStrip.tsx` (new): net worth, investments value, loans left to repay (`useDebtOverview`) and goals on track (same at-risk rule as the Goals page). Each tile links to its page.
- `app/(dashboard)/dashboard/page.tsx`: renders only MonthSheet, then StillToPay and WealthStrip in a 2:1 grid. The old widgets were removed from this page but not deleted.
- `components/layout/HeaderLight.tsx`: the greeting subtitle now reads "Here's how this month looks for both of you."
- `lib/constants.ts`: each `NAV_ITEMS` entry has a `group`. Labels changed: "Dashboard" → "Home" and "Loans" → "Loans & Cards" (routes unchanged). `SidebarLight.tsx` and the dark `Sidebar.tsx` render the group headings.
- `hooks/useMonthlyPlan.ts`: the row type gained the optional `memberId` and `shared` fields.

## How the numbers work
- **Salary**: the saved `MonthlySalary` for that month. If there is none, the most recent earlier month is used and flagged `salaryIsEstimate`. If there is no salary at all, it is 0.
- **Loans & EMIs** = LOAN + CARD_EMI rows. **Investments** = INVESTMENT rows. **Bills** = BILL rows, including bills charged to a card.
- **Card spending, per card** = max(0, statement − that card's EMIs − bills charged to that card this month). If the deductions exceed the statement, `needsStatementUpdate` is set and the UI asks you to update the statement.
- **Left** = salary − loans − investments − bills. **Free** = left − card spending.
- **Paid** = rows with status PAID. SKIPPED rows are listed (struck through) but do not count towards totals or card deductions.
- **Combined** covers the whole household, including rows with no person, so it can be more than the sum of the person cards. Those rows are also listed under "no person set".

## Applying the SQL to another install
From `backend/`:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/patches/monthly-salary.sql
```

Then, from the project root:

```bash
npm run prisma:generate
```

For the test database, run the same `db execute` with `--url` set to the `DATABASE_URL` from `backend/.env.test`.

On this machine, the patch was applied to the local dev DB (`shazah_finance`) and the test DB (`shazah_finance_test`). `prisma migrate diff` against the dev DB now reports no differences from the schema.

## Notes and limits
- **Still to pay** always shows the current calendar month, matching the funding plan. The month sheet follows the header period selector.
- `CashFlowSankey`, `FinancialHealthGauge` and `AiInsightsLight` are no longer rendered anywhere, because `/analytics` is still a dark page. The spec says to move them there only if it is already light.
- The "Loans left to repay" change compares the debt snapshots from the last 31 days.

## Follow-up: who pays what (2026-11-04)
- **Split payments:** the month sheet now respects `OwnershipSplit`. Every entity type the model supports is covered, which today means only investments. A split row is shared between the two people by the stored ratio. Each card shows the person's share with a "half of ₹X" tag, and Combined still counts the full amount. DBS Bank RD (₹30,000) and Malabar Gold Scheme (₹10,000) already had 50/50 splits saved, so no data change was needed for them.
- **Debited-from note:** an item paid from a bank account owned by someone other than the payer shows "Debited from <name>'s account". For example, the Marriage Expense loan is paid by Fathimah but debited from Mohammed's ICICI account. That loan was already stored with borrower Mohammed Gani and payer Fathimah.
- **Bills:** a one-off data update (no schema change) set `memberId` = Mohammed Gani on the 15 active recurring bills in the local dev DB. All 15 previously had `memberId` = NULL. To undo it, set `memberId` back to NULL for those bill ids.

## Follow-up: Undo a payment (2026-11-04)
- `POST /dashboard/monthly-payment/undo` with body `{ type: LOAN | INVESTMENT | CARD_EMI | BILL, id, month?, dueDate? }` (`backend/src/services/paymentUndo.service.ts`) reverses exactly what Mark paid wrote, in one DB transaction:
  - **All types:** deletes the expense transactions, adds the amount back to each bank account they debited, and deletes the month's paid/skipped record. A skipped month only has its record deleted.
  - **Loans:** add the principal back to the remaining balance and reopen a loan the payment had closed.
  - **RD:** removes one instalment.
  - **Card EMI:** reduces the paid-instalment count by one and reopens a completed EMI.
  - **Bills:** reuse the existing bill undo, so `dueDate` is required.
- Loans and card EMIs can only undo their most recent payment, because later instalments are worked out from the balance.
- UI:
  - Home "Mark paid" shows a "Payment recorded · Undo" message for 10 seconds.
  - Paid and skipped items in the month sheet, and in the Loans and Investments payment lists, have an Undo button (with a confirm).
  - The toast component gained an optional `action` slot.
- Tests: `paymentUndo.integration.test.ts` covers every type, the payment-order rule, other users' data, and refusing a second payment in the same month.
- Not yet covered: credit-card bill payments. They keep no payment record today, so there is nothing to reverse safely.

## Follow-up: review fixes and new features (2026-11-04)
Built after the review of the Loans, Investments and Bills sections. Each group is its own commit on `home-redesign`.

**Card money is counted once**
- Ticking a card EMI, or a bill charged to a card, moves no money. The expense and bank debit are recorded once, when the card bill is paid (`payCreditCardBill`, which defaults to the card's linked account).
- Card bill payments keep a `MonthlyPayment` record (`CREDIT_CARD`, statement month). The statement stays on the plan as paid or part paid, and it can be undone (all payments for that month together).
- The funding plan counts a card's statement and only counts its EMIs while no statement is entered.

**Still to pay**
- Sections:
  - Overdue: last month's missed items, plus anything past its date.
  - Due this week.
  - Later this month.
- Each section has a total, and a top line shows what each person still owes, with splits honoured.
- One shared control, `components/shared/PaymentActions.tsx`, is used on Home, Loans, Investments and Bills:
  - The main button reads Mark paid, Tick off or Pay card.
  - The ⋯ menu has Paid from, Amount, Paid on, Skip this month and Payment history.
  - An Undo message appears after each payment or skip.
- Top-up lines have "Done, I moved it", which hides them for the browser session.
- `POST /dashboard/monthly-payment` accepts `month` (this month or last), `amount` and `paidDate`.

**Correctness**
- Payment expenses copy the item's `OwnershipSplit`; undo removes it.
- A lump-sum investment purchase is recorded only once.
- The backend is pinned to India time (`src/lib/timezone.ts`).
- `npm run fix:bill-dates --workspace=backend` normalises bill dates saved the old way:
  - It previews by default, saves a backup, and only writes with `--apply`.
  - It is safe to run again.
  - It was applied to the local dev DB: 8 bill start dates changed, and the bills calendar (July to December) was identical before and after.
- Earlier months show the scheduled EMI, including loans closed since.

**New features** (schema patch `backend/prisma/patches/household-features.sql`, additive and idempotent, applied to the dev and test DBs)
- **Payment history:** every payment, skip and loan change for one item, with Undo where it is safe (`GET /dashboard/payment-history`).
- **Who pays and Split:** available on the bill, loan and card EMI forms. Cards get a payer. New split types `LOAN`, `BILL` and `CARD_EMI` are honoured by the plan, the month sheet and payment expenses.
- **Card statements:** monthly statement entry, plus a "Statement out of date" badge once the saved due date has passed.
- **Reminders:** the header bell lists EMIs, SIPs and card bills due within 3 days or overdue, bill reminders, and maturities within 30 days (`GET /dashboard/reminders`).
- **Loans:**
  - Prepay / part-pay and change interest rate; the latest one can be undone.
  - A "closed" entry is recorded when a loan is paid off.
  - Closed loans show their close date and history (`loan_events` table).
- **SIPs, RDs and gold schemes:** pause for some months, or change the amount from a month on (`PUT /investments/:id/schedule`).

To apply the schema patch elsewhere, run from `backend/`:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/patches/household-features.sql
```

Then run `npm run prisma:generate` from the root.

**Visual check:** `backend/src/scripts/seedDemoTestDb.ts` seeds a demo household into the test database only. It refuses any database name without "test", and its login is in that file. The app was run against it (backend on 5001, frontend on 3001). I checked the home page layout and maths, Mark paid followed by Undo, the ⋯ menu, the Loans page buttons, and the prepay and history dialogs.

**Notes**
- Loans and card EMIs can only undo their most recent payment.
- Undoing a card bill reverses all of that month's payments on it together.
- Card statements cannot be split between people; set the card's payer instead.
- "Done, I moved it" is per browser session. Update the account balance to clear it for good.
