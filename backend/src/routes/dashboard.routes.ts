import { getAccountFundingPlan } from '../services/accountFunding.service';
import { getMonthlyPlan, currentMonth, monthWindow, decideMonthlyPayment } from '../services/monthlyPayments.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { AuthRequest } from '../types';
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/account-funding', async (req: AuthRequest, res) => {
  const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(req.query.month);
  res.json({ success: true, data: await getAccountFundingPlan(req.user!.userId, month) });
});
router.get('/monthly-plan', async (req: AuthRequest, res) => {
  const month = currentMonth();
  res.json({ success: true, data: { current: await getMonthlyPlan(req.user!.userId, month), next: await getMonthlyPlan(req.user!.userId, monthWindow(month).next) } });
});
router.post('/monthly-payment', validate(z.object({ type: z.enum(['LOAN', 'INVESTMENT']), id: z.string().min(1), status: z.enum(['PAID', 'SKIPPED']), accountId: z.string().min(1).optional() })), async (req: AuthRequest, res) => {
  const { type, id, status, accountId } = req.body;
  res.json({ success: true, data: await decideMonthlyPayment(req.user!.userId, type, id, status, accountId) });
});
router.get('/overview', dashboardController.getOverview);
router.get('/net-worth-trend', dashboardController.getNetWorthTrend);
router.get('/cashflow', dashboardController.getCashflow);
router.get('/expense-breakdown', dashboardController.getExpenseBreakdown);
router.get('/insights', dashboardController.getInsights);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

export default router;
