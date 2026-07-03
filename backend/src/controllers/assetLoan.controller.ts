import { Response } from 'express';
import { AuthRequest } from '../types';
import * as assetLoanService from '../services/assetLoanIntelligence.service';

export async function getSummary(req: AuthRequest, res: Response) {
  const result = await assetLoanService.getAssetLoanSummary(req.user!.userId, req.params.loanId);
  res.json({ success: true, data: result });
}

export async function getAllSummaries(req: AuthRequest, res: Response) {
  const result = await assetLoanService.getAllAssetLoanSummaries(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getAmortization(req: AuthRequest, res: Response) {
  const result = await assetLoanService.getAmortizationSchedule(req.user!.userId, req.params.loanId);
  res.json({ success: true, data: result });
}

export async function getInsights(req: AuthRequest, res: Response) {
  const result = await assetLoanService.getAssetLoanInsights(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getHomeEquity(req: AuthRequest, res: Response) {
  const result = await assetLoanService.getHomeEquitySummary(req.user!.userId);
  res.json({ success: true, data: result });
}
