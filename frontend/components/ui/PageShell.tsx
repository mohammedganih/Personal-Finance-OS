import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Three deliberate widths replacing what used to be five ad-hoc max-w-*
// values chosen independently per page.
const WIDTHS = {
  narrow: 'max-w-2xl',   // form-heavy, single-column pages (Settings)
  default: 'max-w-5xl',  // typical list/detail pages
  wide: 'max-w-7xl',     // dense multi-column pages (Dashboard)
} as const;

interface PageShellProps {
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}

export function PageShell({ width = 'default', children }: PageShellProps) {
  return <div className={cn('space-y-6 mx-auto', WIDTHS[width])}>{children}</div>;
}
