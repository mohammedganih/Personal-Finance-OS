import { Response } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';

export async function getOverview(req: AuthRequest, res: Response) {
  const overview = await dashboardService.getDashboardOverview(req.user!.userId);
  res.json({ success: true, data: overview });
}

export async function getCashflow(req: AuthRequest, res: Response) {
  const months = parseInt((req.query.months as string) || '6');
  const data = await dashboardService.getCashflowTrend(req.user!.userId, months);
  res.json({ success: true, data });
}

export async function getExpenseBreakdown(req: AuthRequest, res: Response) {
  const data = await dashboardService.getExpenseBreakdown(req.user!.userId);
  res.json({ success: true, data });
}

export async function getInsights(req: AuthRequest, res: Response) {
  const insights = await dashboardService.getQuickInsights(req.user!.userId);
  res.json({ success: true, data: insights });
}

export async function getRecentTransactions(req: AuthRequest, res: Response) {
  const limit = parseInt((req.query.limit as string) || '5');
  const data = await dashboardService.getRecentTransactions(req.user!.userId, limit);
  res.json({ success: true, data });
}
