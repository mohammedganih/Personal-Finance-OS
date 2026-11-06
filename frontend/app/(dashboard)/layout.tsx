'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SidebarLight } from '@/components/layout/SidebarLight';
import { HeaderLight } from '@/components/layout/HeaderLight';
import { PeriodUrlSync } from '@/components/shared/PeriodUrlSync';
import { QuickAdd } from '@/components/shared/QuickAdd';
import { useAuthStore } from '@/stores/auth.store';
import { useNavStore } from '@/stores/nav.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { open: navOpen, setOpen: setNavOpen } = useNavStore();
  // Following a link closes the drawer on narrow screens.
  useEffect(() => { setNavOpen(false); }, [pathname, setNavOpen]);

  useEffect(() => {
    // Auth state resolves asynchronously now (GET /auth/me, via AuthInitializer)
    // since the tokens are httpOnly cookies with no synchronous client-side read.
    if (isInitialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <Suspense fallback={null}><PeriodUrlSync /></Suspense>
      <SidebarLight />
      {navOpen && <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        <HeaderLight />
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24">
          {children}
        </main>
        <QuickAdd />
      </div>
    </div>
  );
}
