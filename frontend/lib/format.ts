import { format, parseISO } from 'date-fns';

export function formatCurrency(
  amount: number,
  currency = 'INR',
  compact = false
): string {
  if (compact && Math.abs(amount) >= 100000) {
    const crore = amount / 10000000;
    const lakh = amount / 100000;
    if (Math.abs(crore) >= 1) return `₹${crore.toFixed(2)}Cr`;
    return `₹${lakh.toFixed(2)}L`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function getDaysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
