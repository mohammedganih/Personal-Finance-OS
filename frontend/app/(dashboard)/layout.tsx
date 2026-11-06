'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarLight } from '@/components/layout/SidebarLight';
import { HeaderLight } from '@/components/layout/HeaderLight';
import { PeriodUrlSync } from '@/components/shared/PeriodUrlSync';
import { QuickAdd } from '@/components/shared/QuickAdd';
import { useAuthStore } from '@/stores/auth.store';
import { useNavStore } from '@/stores/nav.store';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { open: navOpen, setOpen: setNavOpen } = useNavStore();
  // Following a link closes the drawer on narrow screens.
  useEffect(() => { setNavOpen(false); }, [pathname, setNavOpen]);
  // Scoped light theme: rolled out page-by-page. Every other route keeps the
  // existing dark Sidebar/Header untouched -- see the design plan for why
  // this isn't a global theme toggle (no CSS-variable theme system exists in
  // this app; the dark tokens are hardcoded literal values).
  const LIGHT_ROUTES = ['/dashboard', '/spending', '/investments', '/loans', '/credit-cards', '/bills', '/accounts'];
  // Exact-only, not prefix-matched like the routes above: /goals/[id] is a
  // real sub-route (the goal detail page) that hasn't been redesigned, so it
  // must keep the dark Sidebar/Header rather than inherit a light chrome
  // around still-dark page content.
  const isLightRoute = LIGHT_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/')) || pathname === '/goals';

  useEffect(() => {
    // Auth state resolves asynchronously now (GET /auth/me, via AuthInitializer)
    // since the tokens are httpOnly cookies with no synchronous client-side read.
    if (isInitialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirecting
  }

  return (
    <div className={cn('min-h-screen flex', isLightRoute ? 'bg-paper' : 'bg-bg')}>
      <Suspense fallback={null}><PeriodUrlSync /></Suspense>
      {isLightRoute ? <SidebarLight /> : <Sidebar />}
      {navOpen && <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        {isLightRoute ? <HeaderLight /> : <Header />}
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24">
          {children}
        </main>
        <QuickAdd />
      </div>
    </div>
  );
}
