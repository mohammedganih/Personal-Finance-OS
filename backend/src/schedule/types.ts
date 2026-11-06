import type { ProjectedStatus } from '../lib/billSchedule';

export type ItemType = 'LOAN' | 'CARD_EMI' | 'INVESTMENT' | 'BILL' | 'CARD_STATEMENT';
/** AUTO = confirmed automatically on its due date (auto-debit); undone like PAID. */
export type DueStatus = 'PENDING' | 'PAID' | 'SKIPPED' | 'AUTO';

/** One instalment of one commitment in one month: what every "what's due" list is built from. */
export interface DueItem {
  itemType: ItemType;
  itemId: string;
  name: string;
  /** `YYYY-MM` the instalment belongs to. */
  period: string;
  /** `YYYY-MM-DD` (India time). */
  dueDate: string | null;
  amount: number;
  payerMemberId: string | null;
  /** OwnershipSplit: the other person and the % of this item they pay. */
  split: { memberId: string; pct: number } | null;
  accountId: string | null;
  creditCardId: string | null;
  autoDebit: boolean;
  status: DueStatus;
  paidAmount: number;
  paidDate: string | null;
  /** Loans only: borrower and payer differ, or one of them is unset. */
  shared?: boolean;
  /** Card statements only: what is still owed, and the saved statement it comes from. */
  remaining?: number;
  statementId?: string;
  /** Bills only: the bill calendar's own status (OVERDUE, DUE_TODAY, PAUSED, ...). */
  billStatus?: ProjectedStatus;
}
