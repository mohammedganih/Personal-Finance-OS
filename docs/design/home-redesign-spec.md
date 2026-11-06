# Home page redesign: build spec

Approved by Shafeek on 2026-11-04. The visual reference is `docs/design/home-redesign-mockup.html`; open it in a browser. Match its structure, but build it with the app's existing light tokens (`card-light`, `paper`, `ink`, `mono`, `updown`, `line`) and components (`StatCardLight`, `formatCurrency`, React Query hooks).

## Goal
The home page should read like the family's paper sheet. For each person: salary received, minus loans & EMIs, minus investments, minus bills, gives "left for the month"; minus last month's card spending gives "free to spend & buffer". There is a card for each family member plus a Combined card.

## Backend

1. **MonthlySalary table.** Add a Prisma model `MonthlySalary` with these fields: id, userId, memberId (FamilyMember, required), month (`YYYY-MM` string), amount Decimal(14,2), note?, createdAt, updatedAt. Add `@@unique([userId, memberId, month])` and `@@map("monthly_salaries")`, plus the back-relations on User and FamilyMember.
   - The project uses `db push`, with additive SQL patches for existing installs. Add `backend/prisma/patches/monthly-salary.sql`, idempotent with `CREATE TABLE IF NOT EXISTS`, the unique index and FKs (ON DELETE CASCADE), following the style of `prisma/patches/account-funding.sql`.
   - Routes under `/dashboard`:
     - `GET /month-summary?month=YYYY-MM` (default: current month)
     - `PUT /salary`, body `{ memberId, month, amount }`. It upserts the row and checks that the member belongs to the user. Validate the body with zod.
2. **Month summary service** (`backend/src/services/monthSummary.service.ts`). Reuse `getMonthlyPlan(userId, month)` from `monthlyPayments.service.ts`, extended so each row carries `memberId`, worked out like this:
   - LOAN → `payerMemberId ?? memberId`
   - INVESTMENT → `memberId`
   - BILL → the bill's `memberId`; if it is null and the bill is on a card, the card's `memberId`
   - CREDIT_CARD → card `memberId`
   - CARD_EMI → `emi.memberId ?? creditCard.memberId`
   - Also flag `shared: true` on loans where `memberId` and `payerMemberId` differ, or where either is null.
   - Check what `getBillsCalendar` returns and add `memberId`/`creditCardId` to it if needed.
   - Do not change any existing response fields; only add new ones.
3. **Buckets** (per member, plus combined):
   - salary = MonthlySalary for that month. If there is none, pre-fill from the most recent earlier month and return `salaryIsEstimate: true`.
   - loans = LOAN + CARD_EMI rows
   - investments = INVESTMENT rows
   - bills = BILL rows, including bills charged to a credit card
   - cardSpending, per card = max(0, card statement row amount − that card's CARD_EMI rows this month − BILL rows charged to that card this month). Return statement, deducted and spending per card. If the deduction is more than the statement, set `needsStatementUpdate: true`.
   - left = salary − loans − investments − bills
   - free = left − cardSpending
   - For every bucket, return the total, the amount paid (rows with status PAID), and its items (`id`, `type`, `name`, `amount`, `status`, `dueDate`, `shared`).
   - Rows with no member go into an `unassigned` list (with type and id) so the UI can show "Set who pays".
   - Response shape: `{ month, members: [{ memberId, name, color, emoji, salary, salaryIsEstimate, loans, investments, bills, cards, cardSpending, left, free }], combined: {...same totals...}, unassigned: [...] }`
4. Write vitest unit tests for the bucket maths, using the style of the existing `*.service.test.ts` files. Cover:
   - card split
   - negative card spending clamped to 0
   - salary pre-fill
   - unassigned rows
   - shared flag

## Frontend

1. Add a `useMonthSummary(month)` hook keyed on the period store month/year, and a `useSaveSalary` mutation that invalidates the `dashboard` queries.
2. Add `components/dashboard/home/MonthSheet.tsx`: one card per member plus Combined, as in the mockup.
   - The salary box is editable inline; save on blur or Enter. Show "estimate, from last month" when `salaryIsEstimate` is true.
   - Expandable lines show a paid tick per item and "₹X of ₹Y paid".
   - The card-spending step is amber; the Free to spend total is green (or red if negative).
   - Show a thin stacked bar at the bottom of each card.
   - Show an "N items have no person set" link when `unassigned` has entries.
   - Layout: 3 columns at xl, 1 column below that.
3. Add `components/dashboard/home/StillToPay.tsx`: one date-sorted list of pending rows for the current month, showing date, name, "<person> pays", amount and a Mark paid button.
   - Reuse the existing mark-paid calls from `components/shared/MonthlyPayments.tsx`: `POST /dashboard/monthly-payment` for LOAN/INVESTMENT, `/card-emis/:id/pay` for CARD_EMI, and the bills page's existing pay action for BILL. For credit-card statements, link to /loans.
   - At the top, show one amber line per bank account that needs topping up, using `useAccountFunding()` (only accounts with `amountToAdd > 0`), e.g. "Move ₹X to <account> before <next debit date>".
4. Add `components/dashboard/home/WealthStrip.tsx` with four compact tiles: net worth, investments value, loans left to repay (use the existing debt or loan hooks), and goals on track. Each tile links to its page.
5. In `app/(dashboard)/dashboard/page.tsx`, render only: MonthSheet, then a 2:1 grid of StillToPay and WealthStrip.
   - Remove StatsRow, AccountFundingPlan, MonthlyPayments, UpcomingList, CashFlowSankey, FinancialHealthGauge, GoalProgressLight, InvestmentsOverviewDonut, AiInsightsLight and QuickActionsRow from this page.
   - Do not delete those components. Move CashFlowSankey, FinancialHealthGauge and AiInsightsLight to the top of `/analytics`, inside a light wrapper only if that page is already light; otherwise just leave them unused.
6. Make the HeaderLight greeting subtitle read "Here's how this month looks for both of you."
7. Sidebar: in `lib/constants.ts`, add a `group` to each NAV_ITEMS entry, and render group headings in `SidebarLight.tsx` (and in the dark `Sidebar.tsx` only if that's trivial):
   - (no heading): Home (/dashboard)
   - This month: Transactions, Bills, Budgets
   - Commitments: Loans & Cards (/loans), Investments, Goals
   - Insights: Analytics, Reports
   - (spacer): Accounts, Settings
   - Rename the labels "Dashboard" to "Home" and "Loans" to "Loans & Cards". The routes stay the same.

## Rules
- Do the work on a new git branch, `home-redesign`. Do not push.
- Change nothing else in the database. Apply the SQL patch to the local dev DB (and the test DB if the tests use one), the same way as described in `docs/features/account-funding-plan.md`, then run `npm run prisma:generate`.
- Run the shared, backend and frontend TypeScript checks, frontend lint, `npm test` and the frontend production build. Fix anything you broke.
- When done, write `docs/features/home-redesign.md` (what changed, how to apply the SQL) and commit.
