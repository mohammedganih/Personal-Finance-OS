import { prisma } from '../lib/prisma';
import { assertOwned } from '../lib/ownership';
import { createError } from '../middleware/error.middleware';
import { currentMonth } from '../schedule/dueItems';
import { getMonthlyPlan, MonthlyPlanRow } from './monthlyPayments.service';

// The buffer: money set aside in chosen accounts, after this month's payments
// still due from them. The target defaults to three months of commitments.

export interface BufferAccount { id: string; name: string; balance: number }
export interface Buffer {
  /** Buffer accounts' balance less this month's still-pending payments from them. */
  amount: number;
  balance: number;
  pendingFromBuffer: number;
  target: number;
  /** True when no target is saved and the default (3 × monthly commitments) is used. */
  targetIsDefault: boolean;
  defaultTarget: number;
  monthlyCommitments: number;
  accounts: BufferAccount[];
  /** True when no accounts are chosen and every active savings account counts. */
  accountsAreDefault: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;
export const DEFAULT_BUFFER_MONTHS = 3;

/** Loans, EMIs, investments and bills scheduled for the month (card statements are spending, not commitments). */
export function monthlyCommitments(rows: MonthlyPlanRow[]): number {
  return round(rows.filter((r) => r.type !== 'CREDIT_CARD' && r.status !== 'SKIPPED').reduce((s, r) => s + r.amount, 0));
}

/**
 * Pure: still-pending payments this month that come out of the buffer accounts.
 * Card EMIs and bills charged to a card are paid through the card bill, so only
 * the statement counts for them.
 */
export function pendingFrom(rows: MonthlyPlanRow[], accountIds: Set<string>): number {
  return round(rows
    .filter((r) => r.status === 'PENDING' && r.accountId && accountIds.has(r.accountId))
    .filter((r) => r.type !== 'CARD_EMI' && !(r.type === 'BILL' && r.creditCardId))
    .reduce((s, r) => s + (r.type === 'CREDIT_CARD' ? r.remaining ?? r.amount : r.amount), 0));
}

export async function getBuffer(userId: string, month = currentMonth()): Promise<Buffer> {
  const [settings, accounts, plan] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } }),
    getMonthlyPlan(userId, month),
  ]);
  const chosen = settings?.bufferAccountIds ?? [];
  const accountsAreDefault = chosen.length === 0;
  const buffer = accounts.filter((a) => (accountsAreDefault ? a.type === 'SAVINGS' : chosen.includes(a.id)));
  const balance = round(buffer.reduce((s, a) => s + Number(a.balance), 0));
  const pendingFromBuffer = pendingFrom(plan.rows, new Set(buffer.map((a) => a.id)));
  const commitments = monthlyCommitments(plan.rows);
  const defaultTarget = round(DEFAULT_BUFFER_MONTHS * commitments);
  const targetIsDefault = settings?.bufferTarget == null;
  return {
    amount: round(balance - pendingFromBuffer), balance, pendingFromBuffer,
    target: targetIsDefault ? defaultTarget : Number(settings!.bufferTarget), targetIsDefault, defaultTarget,
    monthlyCommitments: commitments,
    accounts: buffer.map((a) => ({ id: a.id, name: a.name, balance: round(Number(a.balance)) })),
    accountsAreDefault,
  };
}

/** Saves the buffer target (null = default) and which accounts count (empty = all savings accounts). */
export async function saveBufferSettings(userId: string, input: { bufferTarget?: number | null; bufferAccountIds?: string[] }) {
  if (input.bufferTarget != null && !(input.bufferTarget >= 0)) throw createError('Target must be zero or more', 400);
  if (input.bufferAccountIds) await assertOwned(userId, { accounts: input.bufferAccountIds });
  const data = {
    ...(input.bufferTarget !== undefined && { bufferTarget: input.bufferTarget }),
    ...(input.bufferAccountIds !== undefined && { bufferAccountIds: Array.from(new Set(input.bufferAccountIds)) }),
  };
  await prisma.userSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getBuffer(userId);
}
