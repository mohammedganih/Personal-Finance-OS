import { Response } from 'express';
import { AuthRequest } from '../types';
import { z } from 'zod';
import * as creditCardService from '../services/credit-card.service';
import * as statements from '../services/cardStatement.service';
import { payCreditCardBillSchema, saveCardStatementSchema, createCardExpenseSchema, updateCardExpenseSchema, payCardExpenseSchema } from '@shazah/shared';

export async function getCreditCards(req: AuthRequest, res: Response) {
  const cards = await creditCardService.getCreditCards(req.user!.userId);
  res.json({ success: true, data: cards });
}

export async function createCreditCard(req: AuthRequest, res: Response) {
  const card = await creditCardService.createCreditCard(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: card });
}

export async function updateCreditCard(req: AuthRequest, res: Response) {
  const card = await creditCardService.updateCreditCard(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: card });
}

export async function deleteCreditCard(req: AuthRequest, res: Response) {
  await creditCardService.deleteCreditCard(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Credit card deleted' });
}

export async function payCreditCardBill(req: AuthRequest, res: Response) {
  const { amount, accountId, month, paidDate } = payCreditCardBillSchema.parse(req.body);
  const result = await creditCardService.payCreditCardBill(req.user!.userId, req.params.id, amount, accountId, { month, paidDate });
  res.json({ success: true, data: result });
}

// ── Statements ──
export async function getStatements(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.getCardStatements(req.user!.userId, req.params.id) });
}
export async function saveStatement(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.saveCardStatement(req.user!.userId, req.params.id, saveCardStatementSchema.parse(req.body)) });
}
export async function deleteStatement(req: AuthRequest, res: Response) {
  await statements.deleteCardStatement(req.user!.userId, req.params.statementId);
  res.json({ success: true, message: 'Statement deleted' });
}

// ── One-off card expenses ──
const expenseFilter = z.object({ cardId: z.string().min(1).optional(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });
export async function getExpenses(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.getCardExpenses(req.user!.userId, expenseFilter.parse(req.query)) });
}
export async function createExpense(req: AuthRequest, res: Response) {
  res.status(201).json({ success: true, data: await statements.createCardExpense(req.user!.userId, createCardExpenseSchema.parse(req.body)) });
}
export async function updateExpense(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.updateCardExpense(req.user!.userId, req.params.expenseId, updateCardExpenseSchema.parse(req.body)) });
}
export async function deleteExpense(req: AuthRequest, res: Response) {
  await statements.deleteCardExpense(req.user!.userId, req.params.expenseId);
  res.json({ success: true, message: 'Card expense deleted' });
}
export async function payExpense(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.payCardExpense(req.user!.userId, req.params.expenseId, payCardExpenseSchema.parse(req.body ?? {})) });
}
export async function undoExpensePayment(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await statements.undoCardExpensePayment(req.user!.userId, req.params.expenseId) });
}
