import { Response } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';
import * as netWorthService from '../services/netWorth.service';
import { parsePeriod } from '../lib/period';

export async function getOverview(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const overview = await dashboardService.getDashboardOverview(req.user!.userId, month, year);
  // Record-on-read, same idempotent pattern as investment snapshots: net
  // worth here reflects real account/investment/debt balances as of right
  // now (not month-filtered), so it's safe to record under today's date
  // regardless of which period the dashboard's selector is showing.
  await netWorthService.recordNetWorthSnapshot(req.user!.userId, {
    netWorth: overview.netWorth, totalAssets: overview.totalAssets, totalLiabilities: overview.totalLiabilities,
  });
  res.json({ success: true, data: overview });
}

export async function getNetWorthTrend(req: AuthRequest, res: Response) {
  const days = parseInt((req.query.days as string) || '180');
  const data = await netWorthService.getNetWorthTrend(req.user!.userId, days);
  res.json({ success: true, data });
}

export async function getCashflow(req: AuthRequest, res: Response) {
  const months = parseInt((req.query.months as string) || '6');
  const { month, year } = parsePeriod(req);
  const data = await dashboardService.getCashflowTrend(req.user!.userId, months, month, year);
  res.json({ success: true, data });
}

export async function getExpenseBreakdown(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const data = await dashboardService.getExpenseBreakdown(req.user!.userId, month, year);
  res.json({ success: true, data });
}

export async function getInsights(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const insights = await dashboardService.getQuickInsights(req.user!.userId, month, year);
  res.json({ success: true, data: insights });
}

export async function getRecentTransactions(req: AuthRequest, res: Response) {
  const limit = parseInt((req.query.limit as string) || '5');
  const data = await dashboardService.getRecentTransactions(req.user!.userId, limit);
  res.json({ success: true, data });
}
