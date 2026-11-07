import { indiaDateKey } from '../lib/cardPaymentSchedule';
import { dueItems } from './dueItems';
import { decideMonthlyPayment } from '../services/monthlyPayments.service';
import { payCardEMI } from '../services/card-emi.service';
import { payOccurrence } from '../services/bill.service';
import type { ItemType } from './types';

// Auto-debit: the bank (or the card) takes these on their due date, so the app
// confirms them itself instead of waiting for someone to press Mark paid.

export interface AutoConfirmed { itemType: ItemType; itemId: string; name: string; dueDate: string; amount: number }
export interface AutoConfirmResult { month: string; confirmed: AutoConfirmed[]; failed: (AutoConfirmed & { reason: string })[] }

/**
 * Marks this month's auto-debited items that are due on or before today as
 * AUTO, writing the same ledger entries Mark paid would (card EMIs and bills
 * charged to a card move no money, as with Mark paid). Only the current month:
 * earlier months are never back-filled. Safe to run again.
 */
export async function autoConfirm(userId: string, now = new Date()): Promise<AutoConfirmResult> {
  const today = indiaDateKey(now);
  const month = today.slice(0, 7);
  const due = (await dueItems(userId, month, month, { types: ['LOAN', 'INVESTMENT', 'CARD_EMI', 'BILL'], now }))
    .filter((i) => i.autoDebit && i.status === 'PENDING' && i.dueDate && i.dueDate <= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const result: AutoConfirmResult = { month, confirmed: [], failed: [] };
  for (const item of due) {
    const entry: AutoConfirmed = { itemType: item.itemType, itemId: item.itemId, name: item.name, dueDate: item.dueDate!, amount: item.amount };
    try {
      if (item.itemType === 'LOAN' || item.itemType === 'INVESTMENT') {
        await decideMonthlyPayment(userId, item.itemType, item.itemId, 'PAID', undefined, { month, paidDate: item.dueDate!, auto: true });
      } else if (item.itemType === 'CARD_EMI') {
        await payCardEMI(userId, item.itemId, undefined, { auto: true });
      } else {
        await payOccurrence(userId, item.itemId, { dueDate: item.dueDate!, createTransaction: true, paidDate: item.dueDate! } as never, { auto: true });
      }
      result.confirmed.push(entry);
    } catch (error) {
      result.failed.push({ ...entry, reason: (error as Error).message });
    }
  }
  return result;
}

