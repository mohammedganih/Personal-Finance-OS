import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { getLoanRegister } from '../registers/loans';
import { getCardRegister } from '../registers/cards';
import { getBillRegister } from '../registers/bills';
import { getInvestmentRegister } from '../registers/investments';

// Registers: one read per page (Loans, Credit cards, Bills, Savings &
// investments), with the page's totals from the metrics module and the
// schedule engine.
const router = Router();
router.use(authenticate);

router.get('/loans', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getLoanRegister(req.user!.userId) });
});

router.get('/cards', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getCardRegister(req.user!.userId) });
});

router.get('/bills', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getBillRegister(req.user!.userId) });
});

router.get('/investments', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getInvestmentRegister(req.user!.userId) });
});

export default router;
