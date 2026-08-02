'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarLight } from '@/components/layout/SidebarLight';
import { HeaderLight } from '@/components/layout/HeaderLight';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  // Scoped light theme: rolled out page-by-page. Every other route keeps the
  // existing dark Sidebar/Header untouched -- see the design plan for why
  // this isn't a global theme toggle (no CSS-variable theme system exists in
  // this app; the dark tokens are hardcoded literal values).
  const LIGHT_ROUTES = ['/dashboard', '/investments', '/loans', '/bills'];
  const isLightRoute = LIGHT_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

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
      {isLightRoute ? <SidebarLight /> : <Sidebar />}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {isLightRoute ? <HeaderLight /> : <Header />}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
