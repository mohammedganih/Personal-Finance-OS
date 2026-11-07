# Net worth, Month history, Health check, and SIP values

Round 5 of the redesign. It finishes the five-group layout, puts the whole app on one light theme and drops the last of the old tables.

## Net worth (Wealth)
`/net-worth`. Backend: `GET /api/wealth/net-worth` (`services/netWorthPage.service.ts`).

- **What we own:** bank and cash accounts, investments, gold (gold and gold schemes), money lent. **What we owe:** loans, card EMIs, unpaid card statements, money borrowed. The line items come from `getBalanceSheetItems` in the metrics module, and the page totals are those lines added up (`totalsOf`), so they match Home and Loans exactly.
- **Net worth by month:** one point per `month_close` row plus today. Hollow dots mark closes worked out afterwards (approximate). A tooltip shows each month on hover or tap.
- **What changed since the last close:** bank and cash, what we owe, and everything else we own. A close keeps bank balances and total debt, so "everything else" (investments, gold, money lent) is what's left of net worth.
- **Balance check-in:** type each bank balance as the bank app shows it today (`POST /api/wealth/check-in`). Any gap is saved as an `ADJUST` entry (`sourceType` `BALANCE_CHECK`), so the balance changes but income and spending don't. The check-in time is kept in `user_settings.balancesCheckedAt`, even when every balance already matched. Card accounts are refused, since card debt comes from statements.

## Month history (Look back)
`/history`. Backend: `GET /api/lookback/months`, `POST /api/lookback/close-month` (`services/monthClose.service.ts`).

- One row per closed month: salary, commitments (loan EMIs and bills), spent (card statements and everyday spending), saved (into savings and investments), what was left over, and net worth. Opening a row goes to that month's Home sheet (`/dashboard?m=YYYY-MM`).
- **Close month** freezes the current month now. A month closed before it ended shows as "closed early". The daily job closes it again on the 1st with the final figures; a month closed after it ended is left alone.

## Health check (Look back)
`/health`, replacing the old dark Analytics page. `/analytics` and `/reports` redirect here. Backend: `GET /api/lookback/health` (`services/healthCheck.service.ts`).

Every check has a level: Good, Worth a look, or Act on this. Each level has its own icon and label, so it doesn't rely on colour alone.

| Check | How it is worked out | Levels |
|---|---|---|
| Buffer | Buffer amount against its target (`buffer.service`); also months of commitments covered | target met / at least half / less |
| Debt to income | Loan EMIs plus running card EMIs, over this month's salary (or the average income of the last three months) | up to 30% / up to 40% / more |
| Savings rate | Last three full months from the ledger (`savingsRate` in the metrics module) | 20%+ / 10%+ / less |
| Maturing in 6 months | `getMaturityRadar` | shown as a list |
| Out of date | see below | per item |

**Out of date:**
- A SIP or mutual fund valued at what was paid in (no value entered), or whose value was entered 60 or more days ago.
- A stock, ETF or crypto holding whose units or price haven't changed in 60 days (`investments.priceUpdatedAt`).
- A card whose latest statement date has passed with no statement entered.
- Last month not closed.
- Bank balances never checked in, or last checked 30 or more days ago.

**Advice** comes from the engines that were kept: the financial score, debt recommendations and payoff strategy (₹5,000 extra a month), diversification warnings, funding opportunities (a maturity or liquid holding put against the most expensive debt) and asset-loan insights. If one engine fails, only that part is left out.

## SIP and mutual fund values
Decided by Shafeek on 2026-11-07:

- Until a value is entered, a SIP or mutual fund is worth **what was paid in**.
- A value entered (units × NAV, or the value typed straight in) becomes `investments.enteredValue`, as of `priceUpdatedAt`.
- Instalments paid **after** that are added on top of it (`schedule/paidIn.ts`, `paidInWithSince`). An instalment on the same day as the entry is taken as already in the value.
- The Investments page shows "Valued at amount paid in · update value" (or "Value from <date> · update value" once it is 60 days old), and the holding's panel has an **Update value** form.
- Migration `20261107030000_entered_value`: one-off mutual funds keep their units × NAV as the entered value. SIPs start at what was paid in, because their stored units and NAV were typed before later instalments.

## Light theme everywhere
The dark tokens (`bg`, `text`, `border`) now point at the light palette, so the pages that were still dark (Settings, goal detail) render light. The dark `Sidebar` and `Header` are deleted, and the layout always uses the light chrome (no `LIGHT_ROUTES`). Header titles for every page live in `HeaderLight`'s `PAGES` map; pages without an Add button leave it out.

## Removed
- The Analytics page and its widgets: cash flow sankey, cashflow chart, expense pie, comparison, savings trend, spending rhythm heatmap, member split, story cards.
- Read endpoints nothing called any more: `/analytics/spending-rhythm`, `/dashboard/cashflow|expense-breakdown|recent-transactions`, `/debt/overview|debt-trend|health-score|strategy|prepayment|recommendations|funding-opportunities`, all of `/asset-loans`, `/bills/summary|calendar|forecast|insights|analytics`, `/investments/xirr|trend|calendar|diversification|maturities|health`, `/family/analytics` and `/card-emis/summary`. Also their controller handlers, the service functions only they used, and those functions' tests. The engines the Health check uses stay.
- The `monthly_payments` and `bill_occurrences` tables and the `BillOccurrenceStatus` enum (migration `20261107010000_drop_old_payment_tables`). Every row had already been copied into `due_status`. The two tests of the older migrations that read them now create the tables themselves (`src/test/oldTables.ts`).
- The record-on-read snapshots for the investment and debt trends, which nothing reads any more. The `debt_snapshots` and `investment_snapshots` tables stay for now (net_worth_snapshots is still used).

## Phone layout
Every page was checked at 390px wide. Tables drop their secondary columns on a phone (`hideOnPhone`), and the first column carries what matters.
