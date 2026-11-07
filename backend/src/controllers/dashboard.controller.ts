import { Response } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';
import * as netWorthService from '../services/netWorth.service';
import { parsePeriod } from '../lib/period';

export async function getOverview(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const overview = await dashboardService.getDashboardOverview(req.user!.userId, month, year);
  // Net worth history now comes from month closes; nothing is recorded on read.
  res.json({ success: true, data: overview });
}

export async function getNetWorthTrend(req: AuthRequest, res: Response) {
  const days = parseInt((req.query.days as string) || '180');
  const data = await netWorthService.getNetWorthTrend(req.user!.userId, days);
  res.json({ success: true, data });
}

export async function getInsights(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const insights = await dashboardService.getQuickInsights(req.user!.userId, month, year);
  res.json({ success: true, data: insights });
}

