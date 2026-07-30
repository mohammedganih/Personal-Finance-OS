'use client';

import { ReactNode } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface StatCardProps {
  title: string;
  value: number;
  // Overrides the formatted `value` display (e.g. an em dash when there's
  // nothing to show yet) without affecting the color logic below.
  displayValue?: string;
  change?: number;
  changeLabel?: string;
  // Arbitrary context below the value (a caption, a progress bar) for cards
  // that need more than a plain %-change indicator. Mutually exclusive with
  // change/changeLabel in practice -- pick whichever a given card needs.
  footer?: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  isCurrency?: boolean;
  isPercent?: boolean;
  compact?: boolean;
  invertChange?: boolean;
  // When true, a positive value renders success-green (not just the default
  // neutral text) -- for metrics like P&L where positive is unambiguously
  // good news. Off by default: most values (net worth, expenses) aren't
  // inherently "good" just for being positive.
  colorizePositive?: boolean;
  // Forces the value's color regardless of sign -- for cards where "danger"
  // means "this needs attention today", not "this number is negative"
  // (e.g. an overdue-payments total, which is always a positive amount).
  forceColor?: 'danger' | 'success' | 'warning';
}

export function StatCard({
  title,
  value,
  displayValue: displayValueOverride,
  change,
  changeLabel,
  footer,
  icon: Icon,
  iconColor = 'bg-accent-violet/15 text-accent-violet-light',
  isCurrency = true,
  isPercent = false,
  compact = false,
  invertChange = false,
  colorizePositive = false,
  forceColor,
}: StatCardProps) {
  const isPositiveChange = change !== undefined ? (invertChange ? change < 0 : change >= 0) : null;

  const displayValue = displayValueOverride ?? (isCurrency
    ? formatCurrency(value, 'INR', compact)
    : isPercent
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('en-IN'));

  const valueColor = forceColor === 'danger'
    ? 'text-danger'
    : forceColor === 'success'
    ? 'text-success'
    : forceColor === 'warning'
    ? 'text-warning'
    : value < 0 ? 'text-danger' : colorizePositive ? 'text-success' : 'text-text-primary';

  return (
    <div className={cn('glass-card-hover rounded-2xl cursor-default', compact ? 'p-4' : 'p-5')}>
      <div className={cn('flex items-start justify-between', compact ? 'mb-2' : 'mb-4')}>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{title}</p>
        {Icon && (
          <div className={cn(
            'rounded-xl flex items-center justify-center shrink-0',
            compact ? 'w-7 h-7' : 'w-8 h-8',
            iconColor
          )}>
            <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </div>
        )}
      </div>

      <p className={cn('font-bold tracking-tight', compact ? 'text-lg' : 'text-2xl mb-2', valueColor)}>
        {displayValue}
      </p>

      {footer ? (
        <div className="mt-1.5">{footer}</div>
      ) : change !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          {isPositiveChange ? (
            <TrendingUp className="w-3 h-3 text-success" />
          ) : (
            <TrendingDown className="w-3 h-3 text-danger" />
          )}
          <span className={cn('text-xs font-medium', isPositiveChange ? 'text-success' : 'text-danger')}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
          {changeLabel && <span className="text-xs text-text-muted">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
