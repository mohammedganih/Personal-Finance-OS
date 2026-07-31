import { isToday, isYesterday, isThisWeek, isThisMonth, format, parseISO } from 'date-fns';

export interface TransactionDayGroup<T> {
  label: string;
  net: number;
  items: T[];
}

/**
 * Buckets transactions into Today / Yesterday / This Week / This Month /
 * one bucket per earlier calendar month. Relies on the list already being
 * sorted by date descending (the API's default) -- each date test below is
 * monotonically older than the last, so insertion order alone produces the
 * right group order with no extra sort.
 */
export function groupTransactionsByDay<T extends { date: string; type: 'INCOME' | 'EXPENSE'; amount: number }>(
  transactions: T[]
): TransactionDayGroup<T>[] {
  const buckets = new Map<string, T[]>();
  const order: string[] = [];

  for (const t of transactions) {
    const d = parseISO(t.date);
    let label: string;
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else if (isThisWeek(d, { weekStartsOn: 1 })) label = 'This Week';
    else if (isThisMonth(d)) label = 'This Month';
    else label = format(d, 'MMMM yyyy');

    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(t);
  }

  return order.map((label) => {
    const items = buckets.get(label)!;
    const net = items.reduce((sum, t) => sum + (t.type === 'INCOME' ? t.amount : -t.amount), 0);
    return { label, net, items };
  });
}
