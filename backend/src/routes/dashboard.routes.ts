import { getAccountFundingPlan } from '../services/accountFunding.service';
import { getMonthSummary, saveSalary } from '../services/monthSummary.service';
import { undoPayment } from '../services/paymentUndo.service';
import { getPaymentHistory, getReminders } from '../services/paymentHistory.service';
import { decideMonthlyPayment, getPlanAround } from '../services/monthlyPayments.service';
import { autoConfirm } from '../schedule/autoConfirm';
import { getBuffer, saveBufferSettings } from '../services/buffer.service';
import { getWhereWeStand } from '../services/whereWeStand.service';
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
  const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(req.query.month);
  res.json({ success: true, data: await getPlanAround(req.user!.userId, month) });
});
const paymentBody = z.object({
  type: z.enum(['LOAN', 'INVESTMENT']), id: z.string().min(1), status: z.enum(['PAID', 'SKIPPED']), accountId: z.string().min(1).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), amount: z.coerce.number().positive().max(1e12).optional(), paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
router.post('/monthly-payment', validate(paymentBody), async (req: AuthRequest, res) => {
  const { type, id, status, accountId, month, amount, paidDate } = paymentBody.parse(req.body);
  res.json({ success: true, data: await decideMonthlyPayment(req.user!.userId, type, id, status, accountId, { month, amount, paidDate }) });
});
const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const undoBody = z.object({ type: z.enum(['LOAN', 'INVESTMENT', 'CARD_EMI', 'CREDIT_CARD', 'BILL']), id: z.string().min(1), month: monthParam.optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
router.post('/monthly-payment/undo', validate(undoBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await undoPayment(req.user!.userId, undoBody.parse(req.body)) });
});
const historyQuery = z.object({ type: z.enum(['LOAN', 'INVESTMENT', 'CARD_EMI', 'CREDIT_CARD', 'BILL']), id: z.string().min(1) });
router.get('/payment-history', async (req: AuthRequest, res) => {
  const { type, id } = historyQuery.parse(req.query);
  res.json({ success: true, data: await getPaymentHistory(req.user!.userId, type, id) });
});
// Home's Where we stand card: net worth vs last month close, buffer vs target, debt left and when it ends.
router.get('/where-we-stand', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getWhereWeStand(req.user!.userId) });
});
router.get('/buffer', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getBuffer(req.user!.userId) });
});
const bufferBody = z.object({ bufferTarget: z.coerce.number().min(0).max(1e12).nullable().optional(), bufferAccountIds: z.array(z.string().min(1)).max(50).optional() });
router.put('/settings/buffer', validate(bufferBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await saveBufferSettings(req.user!.userId, bufferBody.parse(req.body)) });
});
// Confirms this month's auto-debited items due by today (the daily job does the same for everyone).
router.post('/auto-confirm', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await autoConfirm(req.user!.userId) });
});
router.get('/reminders', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getReminders(req.user!.userId) });
});
router.get('/month-summary', async (req: AuthRequest, res) => {
  const month = monthParam.optional().parse(req.query.month);
  res.json({ success: true, data: await getMonthSummary(req.user!.userId, month) });
});
const salaryBody = z.object({ memberId: z.string().min(1), month: monthParam, amount: z.coerce.number().finite().min(0).max(1e12), note: z.string().max(200).nullable().optional(), accountId: z.string().min(1).nullable().optional() });
router.put('/salary', validate(salaryBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await saveSalary(req.user!.userId, salaryBody.parse(req.body)) });
});
router.get('/overview', dashboardController.getOverview);
router.get('/net-worth-trend', dashboardController.getNetWorthTrend);
router.get('/cashflow', dashboardController.getCashflow);
router.get('/expense-breakdown', dashboardController.getExpenseBreakdown);
router.get('/insights', dashboardController.getInsights);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

export default router;
