import { Response } from 'express';
import { AuthRequest } from '../types';
import * as debtService from '../services/debtIntelligence.service';

export async function getHealthScore(req: AuthRequest, res: Response) {
  const result = await debtService.getHealthScore(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getStrategy(req: AuthRequest, res: Response) {
  const extraPayment = req.query.extraPayment ? parseFloat(req.query.extraPayment as string) : 5000;
  const result = await debtService.getDebtStrategy(req.user!.userId, extraPayment);
  res.json({ success: true, data: result });
}
