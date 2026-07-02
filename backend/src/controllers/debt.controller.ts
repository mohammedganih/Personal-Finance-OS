import { Response } from 'express';
import { AuthRequest } from '../types';
import * as debtService from '../services/debtIntelligence.service';
import * as fundingIntelligenceService from '../services/fundingIntelligence.service';
import { createError } from '../middleware/error.middleware';

export async function getHealthScore(req: AuthRequest, res: Response) {
  const result = await debtService.getHealthScore(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getStrategy(req: AuthRequest, res: Response) {
  const extraPayment = req.query.extraPayment ? parseFloat(req.query.extraPayment as string) : 5000;
  const result = await debtService.getDebtStrategy(req.user!.userId, extraPayment);
  res.json({ success: true, data: result });
}

export async function getPrepayment(req: AuthRequest, res: Response) {
  const debtId = req.query.debtId as string;
  const lumpSum = parseFloat(req.query.lumpSum as string);
  if (!debtId) throw createError('debtId is required', 400);
  if (!Number.isFinite(lumpSum) || lumpSum <= 0) throw createError('lumpSum must be a positive number', 400);

  const result = await debtService.getPrepayment(req.user!.userId, debtId, lumpSum);
  res.json({ success: true, data: result });
}

export async function getCalendar(req: AuthRequest, res: Response) {
  const monthsAhead = req.query.months ? parseInt(req.query.months as string, 10) : 3;
  const result = await debtService.getEMICalendar(req.user!.userId, Math.min(Math.max(monthsAhead, 1), 12));
  res.json({ success: true, data: result });
}

export async function getRecommendations(req: AuthRequest, res: Response) {
  const result = await debtService.getRecommendations(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getFundingOpportunities(req: AuthRequest, res: Response) {
  const monthsAhead = req.query.months ? parseInt(req.query.months as string, 10) : 6;
  const result = await fundingIntelligenceService.getFundingOpportunities(req.user!.userId, Math.min(Math.max(monthsAhead, 1), 24));
  res.json({ success: true, data: result });
}
