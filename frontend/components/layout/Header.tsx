'use client';

import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { format } from 'date-fns';

export function Header() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const currentPage = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <header className="h-16 border-b border-border bg-bg-surface/80 backdrop-blur-md flex items-center justify-between px-6">
      <div>
        <h1 className="text-base font-semibold text-text-primary">
          {currentPage?.label ?? 'Dashboard'}
        </h1>
        <p className="text-xs text-text-muted">
          {format(new Date(), "EEEE, dd MMMM yyyy")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
          <Search className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-violet rounded-full" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-glow-sm cursor-pointer">
          {user?.name?.charAt(0).toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  );
}
