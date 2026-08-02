"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import { ChevronDown, LogOut, Sparkles } from "lucide-react";

/**
 * Light-theme counterpart to Sidebar.tsx, rendered only on /dashboard (see
 * app/(dashboard)/layout.tsx). Kept as a fully separate file rather than a
 * branch inside Sidebar.tsx so the dark file stays a zero-diff, provably
 * untouched artifact -- every other route keeps rendering the dark Sidebar.
 *
 * The "Upgrade to Premium" card is purely decorative, matching the
 * reference -- this app has no subscription tier, so "Upgrade Now" isn't
 * wired to anything real (no fake payment flow).
 */
export function SidebarLight() {
  const pathname = usePathname();
  const logout = useLogout();
  const { user } = useAuthStore();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-paper-card border-r border-line">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
        <div className="w-9 h-9 rounded-lg bg-mono flex items-center justify-center">
          <span className="text-white font-bold text-base">S</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-primary">
            Shazah Finance
          </p>
          <p className="text-xs text-ink-muted">
            What&apos;s happening to our money
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-mono text-white"
                  : "text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive
                    ? "text-white"
                    : "text-ink-muted group-hover:text-ink-primary",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile + Premium card + logout */}
      <div className="px-3 py-4 border-t border-line space-y-3">
        <div className="px-3 py-2.5 rounded-xl bg-paper-subtle flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-mono flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink-primary truncate">
              {user?.name}
            </p>
            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
        </div>

        {/* <div className="rounded-xl bg-mono-muted p-3.5 space-y-2">
          <Sparkles className="w-4 h-4 text-mono" />
          <p className="text-xs font-semibold text-ink-primary">Upgrade to Premium</p>
          <p className="text-[11px] text-ink-muted leading-relaxed">Unlock AI insights, advanced reports and more.</p>
          <button className="w-full flex items-center justify-center gap-1 rounded-full bg-paper-card border border-line text-xs font-medium text-ink-primary py-1.5 hover:bg-paper-subtle transition-colors">
            Upgrade Now
          </button>
        </div> */}

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-secondary hover:bg-updown-down-muted hover:text-updown-down transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
