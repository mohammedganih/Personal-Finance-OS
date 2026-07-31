import { Response } from 'express';
import { AuthRequest } from '../types';
import * as analyticsService from '../services/analytics.service';

export async function getSpendingRhythm(req: AuthRequest, res: Response) {
  const data = await analyticsService.getSpendingRhythm(req.user!.userId);
  res.json({ success: true, data });
}

export async function getFinancialScore(req: AuthRequest, res: Response) {
  const data = await analyticsService.getFinancialScore(req.user!.userId);
  res.json({ success: true, data });
}
