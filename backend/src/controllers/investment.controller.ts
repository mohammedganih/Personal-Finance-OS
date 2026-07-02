import { Response } from 'express';
import { AuthRequest } from '../types';
import * as investmentService from '../services/investment.service';
import * as investmentIntelligenceService from '../services/investmentIntelligence.service';

export async function getInvestments(req: AuthRequest, res: Response) {
  const result = await investmentService.getInvestments(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getPortfolioSummary(req: AuthRequest, res: Response) {
  const result = await investmentService.getPortfolioSummary(req.user!.userId);
  // Record-on-read: each summary fetch upserts today's snapshot so the trend
  // chart accumulates real data points as the app is used.
  await investmentIntelligenceService.recordDailySnapshot(req.user!.userId, {
    totalInvested: result.totalInvested, totalCurrent: result.totalCurrent, totalPnl: result.totalPnl,
  });
  res.json({ success: true, data: result });
}

export async function getAnnualizedReturns(req: AuthRequest, res: Response) {
  const result = await investmentIntelligenceService.getAnnualizedReturns(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getPortfolioTrend(req: AuthRequest, res: Response) {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 180;
  const result = await investmentIntelligenceService.getPortfolioTrend(req.user!.userId, Math.min(Math.max(days, 1), 730));
  res.json({ success: true, data: result });
}

export async function getInvestmentCalendar(req: AuthRequest, res: Response) {
  const monthsAhead = req.query.months ? parseInt(req.query.months as string, 10) : 3;
  const result = await investmentIntelligenceService.getInvestmentCalendar(req.user!.userId, Math.min(Math.max(monthsAhead, 1), 12));
  res.json({ success: true, data: result });
}

export async function getDiversification(req: AuthRequest, res: Response) {
  const result = await investmentIntelligenceService.getDiversification(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getMaturityRadar(req: AuthRequest, res: Response) {
  const monthsAhead = req.query.months ? parseInt(req.query.months as string, 10) : 6;
  const result = await investmentIntelligenceService.getMaturityRadar(req.user!.userId, Math.min(Math.max(monthsAhead, 1), 24));
  res.json({ success: true, data: result });
}

export async function createInvestment(req: AuthRequest, res: Response) {
  const investment = await investmentService.createInvestment(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: investment });
}

export async function updateInvestment(req: AuthRequest, res: Response) {
  const investment = await investmentService.updateInvestment(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: investment });
}

export async function deleteInvestment(req: AuthRequest, res: Response) {
  await investmentService.deleteInvestment(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Investment deleted' });
}

export async function payInvestment(req: AuthRequest, res: Response) {
  const { accountId } = req.body as { accountId?: string };
  const result = await investmentService.payInvestment(req.user!.userId, req.params.id, accountId);
  res.json({ success: true, data: result });
}
