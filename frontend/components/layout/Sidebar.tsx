'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { LogOut, Wallet } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const { user } = useAuthStore();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-bg-surface border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm">
          <Wallet className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Shazah Finance</p>
          <p className="text-xs text-text-muted">Command Center</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-accent-violet/15 text-accent-violet-light'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-accent-violet-light' : 'text-text-muted group-hover:text-text-primary'
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-violet-light" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="px-3 py-2.5 rounded-xl bg-bg-elevated flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
