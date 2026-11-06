import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { closeCurrentMonth, getMonthHistory, historyRow } from '../services/monthClose.service';
import { getHealthCheck } from '../services/healthCheck.service';

// Look back: Month history (closed months, Close month) and the Health check.
const router = Router();
router.use(authenticate);

router.get('/months', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getMonthHistory(req.user!.userId) });
});
router.post('/close-month', async (req: AuthRequest, res) => {
  res.json({ success: true, data: historyRow(await closeCurrentMonth(req.user!.userId)) });
});
router.get('/health', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getHealthCheck(req.user!.userId) });
});

export default router;
