import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/overview', dashboardController.getOverview);
router.get('/cashflow', dashboardController.getCashflow);
router.get('/expense-breakdown', dashboardController.getExpenseBreakdown);
router.get('/insights', dashboardController.getInsights);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

export default router;
