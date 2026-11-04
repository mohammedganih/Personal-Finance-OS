import { Router } from 'express';
import * as loanController from '../controllers/loan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createLoanSchema, updateLoanSchema } from '../validators/loan.validator';
import { z } from 'zod';
import { AuthRequest } from '../types';
import { changeLoanRate, getLoanEvents, prepayLoan, undoLoanEvent } from '../services/loanEvents.service';

const router = Router();

router.use(authenticate);

router.get('/', loanController.getLoans);
router.get('/summary', loanController.getLoanSummary);
router.post('/', validate(createLoanSchema), loanController.createLoan);
router.put('/:id', validate(updateLoanSchema), loanController.updateLoan);
router.delete('/:id', loanController.deleteLoan);
router.post('/:id/pay', loanController.payLoanEMI);
router.post('/:id/link-asset', loanController.linkLoanAsset);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const prepayBody = z.object({ amount: z.number().positive().max(1e12), accountId: z.string().min(1).optional(), date: day.optional(), note: z.string().max(200).optional() });
const rateBody = z.object({ interestRate: z.number().min(0).max(100), emi: z.number().positive().max(1e12).optional(), date: day.optional(), note: z.string().max(200).optional() });
router.get('/:id/events', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await getLoanEvents(req.user!.userId, req.params.id) });
});
router.post('/:id/prepay', validate(prepayBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await prepayLoan(req.user!.userId, req.params.id, prepayBody.parse(req.body)) });
});
router.post('/:id/rate', validate(rateBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await changeLoanRate(req.user!.userId, req.params.id, rateBody.parse(req.body)) });
});
router.post('/:id/events/:eventId/undo', async (req: AuthRequest, res) => {
  res.json({ success: true, data: await undoLoanEvent(req.user!.userId, req.params.id, req.params.eventId) });
});

export default router;
