'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface KPICardProps {
  title: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  isPercent?: boolean;
  compact?: boolean;
  invertChange?: boolean;
  // When true, a positive value renders success-green (not just the default
  // neutral text) -- for metrics like P&L where positive is unambiguously
  // good news. Off by default: most KPICard values (net worth, expenses)
  // aren't inherently "good" just for being positive.
  colorizePositive?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'bg-accent-violet/15 text-accent-violet-light',
  isCurrency = true,
  isPercent = false,
  compact = false,
  invertChange = false,
  colorizePositive = false,
}: KPICardProps) {
  const isPositiveChange = change !== undefined ? (invertChange ? change < 0 : change >= 0) : null;

  const displayValue = isCurrency
    ? formatCurrency(value, 'INR', compact)
    : isPercent
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('en-IN');

  const valueColor = value < 0 ? 'text-danger' : colorizePositive ? 'text-success' : 'text-text-primary';

  return (
    <div className="glass-card-hover rounded-2xl p-5 cursor-default">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{title}</p>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <p className={cn('text-2xl font-bold tracking-tight mb-2', valueColor)}>
        {displayValue}
      </p>

      {change !== undefined && (
        <div className="flex items-center gap-1.5">
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
