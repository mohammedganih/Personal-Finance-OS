import { Response } from 'express';
import { AuthRequest } from '../types';
import * as transactionService from '../services/transaction.service';
import { transactionQuerySchema } from '../validators/transaction.validator';

export async function getTransactions(req: AuthRequest, res: Response) {
  const query = transactionQuerySchema.parse(req.query);
  const result = await transactionService.getTransactions(req.user!.userId, query);
  res.json({ success: true, data: result });
}

export async function createTransaction(req: AuthRequest, res: Response) {
  const transaction = await transactionService.createTransaction(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: transaction });
}

export async function updateTransaction(req: AuthRequest, res: Response) {
  const transaction = await transactionService.updateTransaction(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: transaction });
}

export async function deleteTransaction(req: AuthRequest, res: Response) {
  await transactionService.deleteTransaction(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Transaction deleted' });
}
