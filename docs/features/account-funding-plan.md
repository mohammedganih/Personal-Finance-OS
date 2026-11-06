# Account Funding Plan implementation

The dashboard now has an account allocation summary and responsive bank cards before charts, followed by the existing monthly overview and an improved Next 7 Days list. Existing features and pre-existing workspace changes were preserved.

## Files changed for this feature

- backend/prisma/schema.prisma
- backend/prisma/patches/account-funding.sql (new)
- backend/src/routes/dashboard.routes.ts
- backend/src/services/accountFunding.service.ts (new)
- backend/src/services/accountFunding.service.test.ts (new)
- backend/src/services/accountFunding.integration.test.ts (new)
- backend/src/services/account.service.ts
- backend/src/services/bill.service.ts
- backend/src/services/credit-card.service.ts
- backend/src/services/investment.service.ts
- backend/src/services/loan.service.ts
- backend/src/services/monthlyPayments.service.ts (extended existing workspace file)
- frontend/app/(dashboard)/dashboard/page.tsx
- frontend/components/dashboard/AccountFundingPlan.tsx (new)
- frontend/components/dashboard/light/UpcomingList.tsx
- frontend/components/settings/AccountSetup.tsx
- frontend/components/loans/CreditCardForm.tsx
- frontend/components/loans/LoanForm.tsx
- frontend/components/investments/InvestmentForm.tsx
- frontend/hooks/useAccountFunding.ts (new)
- frontend/hooks/useAccounts.ts
- frontend/types/index.ts
- packages/shared/src/schemas/account.schema.ts
- packages/shared/src/schemas/credit-card.schema.ts
- packages/shared/src/schemas/loan.schema.ts
- packages/shared/src/schemas/investment.schema.ts
- docs/features/account-funding-plan.md (this report)

## UI and design improvements

Reuses card-light, existing color/typography/spacing tokens, currency/date formatters, family members, account forms, React Query and payment schedules. Account cards stack on mobile; two columns on tablets; three on wide screens. Shows owner, current/target balances, amount to add, surplus, urgency, next debit, overdue amounts, seven-day totals, month totals and expandable payment breakdowns. Unlinked/deleted/inactive-account obligations are explicit funding gaps with edit links. Optional transfer suggestions never move money. Upcoming payments now exclude recorded paid/skipped items and use clamped schedule dates. Actions in bank settings are accessible on touch and keyboard; account/loan/card forms scroll within the viewport.

## Data changes

Accounts gain optional bankName, preferredMinimum (default 0), isActive (default true). Existing balance and memberId are reused; joint ownership can be saved as null. Credit cards gain an optional bankAccountId relation, inherited by their card EMIs. Loans and investments gain optional paymentDay (1-31). Investments gain recurringActive (default true), allowing contribution schedules to stop without removing the holding. Shared schemas validate these fields; account-owner and credit-card account links enforce user ownership.

## Calculations

- Outstanding funding uses pending obligations through current month end or the next seven days, whichever is later, plus known overdue bill occurrences.
- Target = max(outstanding obligations, preferred minimum).
- Add = max(target - current balance, 0).
- Surplus = max(current balance - target, 0).
- Total to allocate sums individual account deficits; another account's surplus does not erase them.
- Paid/skipped/paused/inactive records are excluded. Duplicate occurrences and malformed dates/amounts cannot inflate requirements. Missing/non-finite balances become 0; negative balances remain overdrafts and increase the deficit.
- Next seven days means today plus six following dates, in Asia/Kolkata, including cross-month/year dates. At month end the target horizon also extends into next month to fund imminent debits, while the remaining-this-month metric stays confined to the current month.
- Suggested transfers draw only from each source account's calculated surplus, prioritizing earlier debit dates, and retain its full monthly target.

## Assumptions and limits

Funding always concerns the current calendar month (extended for imminent next-seven-day debits) and current balances, independently of the analytics period selector. Only active INR savings/checking accounts participate; there is no currency conversion. Payment days default to original loan start/investment purchase day when unset and clamp to the last day of shorter months. Bill frequencies reuse the existing scheduling engine. Card-charged subscriptions are excluded from direct bank debits. Saved statement balances and card EMIs follow the app's existing separate-obligation convention: do not enter the same EMI amount in both. The app does not have a salary schedule or reliable historical loan/SIP arrears ledger, so neither is invented. No bank synchronization or transfer execution is added.

## Migration

Applied the additive, idempotent backend/prisma/patches/account-funding.sql to the local application and guarded test databases; existing records, balances and payment links are preserved. Generated the Prisma client. Other installations must apply the same SQL with `npx prisma db execute --schema prisma/schema.prisma --file prisma/patches/account-funding.sql` from backend, then run `npm run prisma:generate` from the project root. This project has no existing versioned Prisma migration directory and uses db push; an isolated SQL patch avoids pushing unrelated in-progress schema changes.

## Validation and next steps

All 269 tests across 26 files passed, including pure funding scenarios and database integration tests. Shared/backend/frontend TypeScript checks, frontend lint and production builds passed. Live visual/browser validation was unavailable because no browser was connected; the existing dashboard design reference and component/styles were inspected instead.

Review current balances/safety amounts and link all obligations, especially credit cards. Configure actual monthly debit days where they differ from start dates. Check the dashboard on desktop/tablet/mobile when a browser is connected. A future salary schedule and historical installment ledger would enable salary-aware funding and reliable older EMI/SIP arrears.
