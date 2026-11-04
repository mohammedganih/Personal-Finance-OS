"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { RemindersBell } from "@/components/layout/RemindersBell";
import { useAuthStore } from "@/stores/auth.store";
import { PeriodSelectorLight } from "@/components/shared/PeriodSelectorLight";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { LoanForm } from "@/components/loans/LoanForm";
import { BillForm } from "@/components/bills/BillForm";
import { GoalForm } from "@/components/goals/GoalForm";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { useBudgets } from "@/hooks/useBudgets";
import { AccountForm } from "@/components/settings/AccountSetup";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Light-theme counterpart to Header.tsx, rendered on every light-theme route
 * (see app/(dashboard)/layout.tsx's LIGHT_ROUTES). Every other route keeps
 * the dark Header. Content branches on pathname the same way SidebarLight
 * already branches its active nav item -- one shared file per route's own
 * title/action, rather than prop-drilling through the layout or forking a
 * second header file per page.
 */
export function HeaderLight() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const isInvestments = pathname === "/investments" || pathname.startsWith("/investments/");
  const isLoans = pathname === "/loans" || pathname.startsWith("/loans/");
  const isBills = pathname === "/bills" || pathname.startsWith("/bills/");
  // Exact match only -- /goals/[id] (the goal detail page) isn't a light
  // route, see app/(dashboard)/layout.tsx.
  const isGoals = pathname === "/goals";
  const isTransactions = pathname === "/transactions" || pathname.startsWith("/transactions/");
  const isBudgets = pathname === "/budgets" || pathname.startsWith("/budgets/");
  const isAccounts = pathname === "/accounts" || pathname.startsWith("/accounts/");

  // Only Budgets' Add flow needs this (BudgetForm excludes already-budgeted
  // categories from its picker) -- disabled everywhere else so this fetch
  // doesn't fire on every other light route too. React Query dedupes
  // against the same ['budgets', month, year] query the page's own cards
  // already run.
  const { data: budgets } = useBudgets(isBudgets);

  return (
    <>
      <header className="h-16 border-b border-line bg-paper-card flex items-center justify-between px-6">
        {isInvestments ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Investments</h1>
            <p className="text-xs text-ink-muted">Track your portfolio performance and grow your wealth.</p>
          </div>
        ) : isLoans ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Loans &amp; Cards</h1>
            <p className="text-xs text-ink-muted">Track, manage and pay off your loans faster.</p>
          </div>
        ) : isBills ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Bills &amp; Subscriptions</h1>
            <p className="text-xs text-ink-muted">Track and manage all your recurring bills and subscriptions.</p>
          </div>
        ) : isGoals ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Goals</h1>
            <p className="text-xs text-ink-muted">Plan your future and achieve your dreams.</p>
          </div>
        ) : isTransactions ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Transactions</h1>
            <p className="text-xs text-ink-muted">Track, analyze and manage your money flow in detail.</p>
          </div>
        ) : isBudgets ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Budgets</h1>
            <p className="text-xs text-ink-muted">Plan your spending and stay in control of your money.</p>
          </div>
        ) : isAccounts ? (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">Accounts</h1>
            <p className="text-xs text-ink-muted">All your accounts in one place.</p>
          </div>
        ) : (
          <div>
            <h1 className="text-base font-semibold text-ink-primary">
              {greeting(new Date().getHours())}, {firstName}
            </h1>
            <p className="text-xs text-ink-muted">
              Here&apos;s how this month looks for both of you.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Bills, Transactions and Budgets are genuinely month-scoped, so
              they keep the period selector -- unlike Investments/Loans/
              Goals/Accounts, where every figure shown is "as of now"
              (balances, net worth), not scoped to a selected month. */}
          {!isInvestments && !isLoans && !isGoals && !isAccounts && <PeriodSelectorLight />}
          <button
            aria-label="Search"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-paper-card border border-line text-ink-secondary hover:text-ink-primary hover:border-line-strong transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <RemindersBell />
          <button
            onClick={() => setShowForm(true)}
            className="h-9 flex items-center gap-1.5 rounded-full bg-mono hover:bg-mono-hover text-white text-sm font-medium px-4 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isInvestments ? "Add Investment" : isLoans ? "Add Loan" : isBills ? "Add New" : isGoals ? "Add Goal" : isTransactions ? "Add Transaction" : isBudgets ? "Create Budget" : isAccounts ? "Add Account" : "Add"}
          </button>
        </div>
      </header>

      {showForm && (isInvestments
        ? <InvestmentForm onClose={() => setShowForm(false)} />
        : isLoans
        ? <LoanForm onClose={() => setShowForm(false)} />
        : isBills
        ? <BillForm onClose={() => setShowForm(false)} />
        : isGoals
        ? <GoalForm onClose={() => setShowForm(false)} />
        : isBudgets
        ? <BudgetForm existingBudgets={budgets ?? []} onClose={() => setShowForm(false)} />
        : isAccounts
        ? <AccountForm onClose={() => setShowForm(false)} />
        : <TransactionForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
