import { Response } from 'express';
import { AuthRequest } from '../types';
import * as creditCardService from '../services/credit-card.service';

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
  const { amount, accountId } = req.body as { amount: number; accountId?: string };
  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, message: 'Payment amount must be positive' });
    return;
  }
  const result = await creditCardService.payCreditCardBill(req.user!.userId, req.params.id, amount, accountId);
  res.json({ success: true, data: result });
}
