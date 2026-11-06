import { Router } from 'express';
import * as investmentController from '../controllers/investment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createInvestmentSchema, updateInvestmentSchema } from '../validators/investment.validator';
import { z } from 'zod';
import { AuthRequest } from '../types';
import { setInvestmentSchedule } from '../services/investment.service';

const router = Router();

router.use(authenticate);

router.get('/', investmentController.getInvestments);
router.get('/summary', investmentController.getPortfolioSummary);
router.post('/', validate(createInvestmentSchema), investmentController.createInvestment);
router.put('/:id', validate(updateInvestmentSchema), investmentController.updateInvestment);
router.delete('/:id', investmentController.deleteInvestment);
router.post('/:id/pay', investmentController.payInvestment);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const scheduleBody = z.object({
  pauseFrom: month.nullable().optional(), pauseUntil: month.nullable().optional(),
  nextMonthlyAmount: z.number().positive().max(1e12).nullable().optional(), nextAmountFrom: month.nullable().optional(),
});
router.put('/:id/schedule', validate(scheduleBody), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await setInvestmentSchedule(req.user!.userId, req.params.id, scheduleBody.parse(req.body)) });
});

export default router;
