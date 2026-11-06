import type { TransactionKind, TransactionType } from '@prisma/client';

/** The kind a hand-typed entry gets from its direction: money in is income, money out is spending. */
export function kindForType(type: TransactionType): TransactionKind {
  return type === 'INCOME' ? 'INCOME' : 'SPEND';
}

/** `YYYY-MM` of a date in India time, the household's calendar. */
export function monthOf(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}
