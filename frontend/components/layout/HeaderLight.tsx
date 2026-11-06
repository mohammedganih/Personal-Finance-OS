"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Menu } from "lucide-react";
import { useNavStore } from "@/stores/nav.store";
import { useAuthStore } from "@/stores/auth.store";
import { RemindersBell } from "@/components/layout/RemindersBell";
import { PeriodSelectorLight } from "@/components/shared/PeriodSelectorLight";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { LoanForm } from "@/components/loans/LoanForm";
import { CreditCardForm } from "@/components/loans/CreditCardForm";
import { BillForm } from "@/components/bills/BillForm";
import { GoalForm } from "@/components/goals/GoalForm";
import { AccountForm } from "@/components/settings/AccountSetup";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type FormKey = "transaction" | "investment" | "loan" | "card" | "bill" | "goal" | "account";
interface PageHead {
  title: string;
  subtitle: string;
  /** The Add button's label and form; pages without one leave these out. */
  add?: string;
  form?: FormKey;
  /** Month-scoped pages show the month picker (kept in the URL as ?m=). */
  monthly: boolean;
}

// Each page: title, one line on what the page answers, and its Add button.
const PAGES: Record<string, PageHead> = {
  "/spending": { title: "Spending", subtitle: "Where the money went this month, bank and cards together.", add: "Add spend", form: "transaction", monthly: true },
  "/loans": { title: "Loans", subtitle: "What we owe, who pays, and when each one ends.", add: "Add loan", form: "loan", monthly: false },
  "/credit-cards": { title: "Credit cards", subtitle: "What's on each statement, what's building, when it's due.", add: "Add card", form: "card", monthly: false },
  "/bills": { title: "Bills & subscriptions", subtitle: "What repeats, what it costs a month, and what's due next.", add: "Add bill", form: "bill", monthly: false },
  "/investments": { title: "Savings & investments", subtitle: "What we hold, what goes in each month, what matures when.", add: "Add investment", form: "investment", monthly: false },
  "/goals": { title: "Goals", subtitle: "Are we on track for each goal, and what does it need a month?", add: "Add goal", form: "goal", monthly: false },
  "/accounts": { title: "Accounts", subtitle: "All your accounts in one place.", add: "Add account", form: "account", monthly: false },
  "/net-worth": { title: "Net worth", subtitle: "What we own, less what we owe, and how it moved month to month.", monthly: false },
  "/history": { title: "Month history", subtitle: "Every closed month: salary, commitments, spending and what was saved.", monthly: false },
  "/health": { title: "Health check", subtitle: "Is the buffer enough, is debt in hand, and is any data out of date?", monthly: false },
  "/settings": { title: "Settings", subtitle: "Household, people, accounts, categories and your profile.", monthly: false },
};

/** Header for the light pages: the page's title and Add button, or Home's greeting. */
export function HeaderLight() {
  const setNavOpen = useNavStore((st) => st.setOpen);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const page = Object.entries(PAGES).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];
  const head = page ?? { title: `${greeting(new Date().getHours())}, ${firstName}`, subtitle: "Here's how this month looks for both of you.", add: "Add spend", form: "transaction" as FormKey, monthly: true };
  const close = () => setShowForm(false);

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-2 border-b border-line bg-paper-card px-4 sm:px-6">
        <button type="button" onClick={() => setNavOpen(true)} aria-label="Open menu" className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-secondary hover:bg-paper-subtle lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink-primary">{head.title}</h1>
          <p className="truncate text-xs text-ink-muted">{head.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {head.monthly && <PeriodSelectorLight />}
          <RemindersBell />
          {head.add && <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-mono px-3 text-sm font-medium text-white transition-colors hover:bg-mono-hover sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{head.add}</span>
          </button>}
        </div>
      </header>

      {showForm && (
        head.form === "investment" ? <InvestmentForm onClose={close} />
        : head.form === "loan" ? <LoanForm onClose={close} />
        : head.form === "card" ? <CreditCardForm onClose={close} />
        : head.form === "bill" ? <BillForm onClose={close} />
        : head.form === "goal" ? <GoalForm onClose={close} />
        : head.form === "account" ? <AccountForm onClose={close} />
        : <TransactionForm onClose={close} />
      )}
    </>
  );
}
