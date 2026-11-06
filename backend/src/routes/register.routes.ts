import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { getLoanRegister } from '../registers/loans';

// Registers: one read per page (Loans, Credit cards, Bills, Savings &
// investments), with the page's totals from the metrics module and the
// schedule engine.
const router = Router();
router.use(authenticate);

router.get('/loans', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getLoanRegister(req.user!.userId) });
});

export default router;
