"use client";

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useReminders, Reminder } from "@/hooks/usePaymentHistory";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const when = (r: Reminder) =>
  r.kind === "MATURITY"
    ? `matures ${r.daysLeft === 0 ? "today" : `in ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`}`
    : r.daysLeft < 0
      ? `${-r.daysLeft} day${r.daysLeft === -1 ? "" : "s"} overdue`
      : r.daysLeft === 0
        ? "due today"
        : `due in ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`;

/** Header bell: EMIs, SIPs, card bills and bills due soon or overdue, and maturities. */
export function RemindersBell() {
  const { data } = useReminders();
  const { data: members } = useFamilyMembers();
  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(" ")[0]]));
  const reminders = data ?? [];
  const urgent = reminders.filter((r) => r.kind !== "MATURITY").length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={urgent ? `Reminders, ${urgent} due` : "Reminders"}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-paper-card border border-line text-ink-secondary hover:text-ink-primary hover:border-line-strong transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {urgent > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-updown-down px-1 text-[10px] font-semibold text-white">
              {urgent > 9 ? "9+" : urgent}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-paper-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-ink-primary">Reminders</p>
          {reminders.length === 0 && <p className="py-4 text-center text-xs text-ink-muted">Nothing due in the next few days.</p>}
          <ul className="grid gap-1">
            {reminders.map((r) => (
              <li key={r.key}>
                <Popover.Close asChild>
                  <Link href={r.href} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-paper-subtle">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink-primary">{r.name}</span>
                      <span className={cn("text-[11px]", r.kind === "OVERDUE" ? "text-updown-down" : "text-ink-muted")}>
                        {when(r)} · {formatDate(r.dueDate, "d MMM")}
                        {r.memberId && names.get(r.memberId) ? ` · ${names.get(r.memberId)}` : ""}
                      </span>
                    </span>
                    {r.amount != null && <span className="shrink-0 text-[13px] tabular-nums text-ink-primary">{formatCurrency(r.amount)}</span>}
                  </Link>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
