import { Router } from 'express';
import * as investmentController from '../controllers/investment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createInvestmentSchema, updateInvestmentSchema } from '../validators/investment.validator';

const router = Router();

router.use(authenticate);

router.get('/', investmentController.getInvestments);
router.get('/summary', investmentController.getPortfolioSummary);
router.get('/xirr', investmentController.getAnnualizedReturns);
router.get('/trend', investmentController.getPortfolioTrend);
router.get('/calendar', investmentController.getInvestmentCalendar);
router.get('/diversification', investmentController.getDiversification);
router.get('/maturities', investmentController.getMaturityRadar);
router.post('/', validate(createInvestmentSchema), investmentController.createInvestment);
router.put('/:id', validate(updateInvestmentSchema), investmentController.updateInvestment);
router.delete('/:id', investmentController.deleteInvestment);
router.post('/:id/pay', investmentController.payInvestment);

export default router;
