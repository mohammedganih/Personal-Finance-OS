# Shazah Finance docs

The redesign plan approved by Shafeek on 2026-11-06 lives here: [Shazah Finance: redesign plan](https://claude.ai/artifact/FFNbhYbvRGzk55zFTu9amx).

## Target architecture
Every number comes from one ledger. Each transaction carries a **kind** (`INCOME`, `SPEND`, `TRANSFER`, `SAVE`, `DEBT`, `ADJUST`), so salary is income, investment instalments are saving rather than spending, EMIs are debt, and transfers between our own accounts are neither. Each transaction can also point back to what created it (`sourceType`/`sourceId`) and to the month it belongs to (`period`). One **schedule engine** will work out what is due for every loan, card, EMI, investment and bill, so Home, the commitment pages and the reminders bell all show the same status. One **metrics module** (`backend/src/metrics/`) owns net worth, total debt, monthly flows and the savings rate, and every page reads from it. The selected **month lives in the URL** (`?m=YYYY-MM`), so every part of a page shows the same month and survives a refresh. The sidebar shrinks to **five groups**: This month (Home, Spending), Commitments (Loans, Credit cards, Bills & subscriptions), Wealth (Net worth, Savings & investments, Goals), Look back (Month history, Health check) and Setup (Accounts & settings).

## Features (what was built and how it works)
- [Home redesign](features/home-redesign.md): the per-person month sheet, Still to pay, undo, payment history, splits, loan changes, reminders.
- [Credit cards](features/credit-cards.md): monthly statements, card expenses, pay / undo, Home card spending.
- [Account funding plan](features/account-funding-plan.md): how much to move into each bank account before payments go out.
- [Ledger kinds, transfers, salary income and metrics](features/ledger-and-metrics.md): redesign foundation part 1.
- [Schedule engine, due status and auto-debit](features/schedule-and-auto-debit.md): redesign foundation part 2.
- [Home v2](features/home-v2.md): spent so far, expected salary, buffer, Where we stand, month close, quick add, phone layout.
- [Registers and Spending](features/registers.md): Loans, Credit cards, Bills, Savings & investments as registers; Spending; one category list; five nav groups.

## Design references
- [Home redesign spec](design/home-redesign-spec.md): the brief the Home page was built from.
- [Home redesign mockup](design/home-redesign-mockup.html): open in a browser for the visual reference.

## Database changes
Schema changes are Prisma migrations in `backend/prisma/migrations/` (baseline `0_init`, then one folder per change). Payment statuses live in `due_status`; the old `monthly_payments` and `bill_occurrences` tables are read-only and due for removal (see the schedule doc). Older installs got hand-applied SQL patches, kept in `backend/prisma/patches/` for reference; they are already part of the `0_init` baseline.
