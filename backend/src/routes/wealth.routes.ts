import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { AuthRequest } from '../types';
import { checkInBalances, getNetWorthPage } from '../services/netWorthPage.service';

// Wealth: the Net worth page and the balance check-in.
const router = Router();
router.use(authenticate);

router.get('/net-worth', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getNetWorthPage(req.user!.userId) });
});

const checkInBody = z.object({
  balances: z.array(z.object({ accountId: z.string().min(1), balance: z.coerce.number().finite().min(-1e12).max(1e12) })).min(1).max(50),
});
router.post('/check-in', validate(checkInBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await checkInBalances(req.user!.userId, checkInBody.parse(req.body).balances) });
});

export default router;
