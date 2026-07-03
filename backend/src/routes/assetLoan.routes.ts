import { Router } from 'express';
import * as assetLoanController from '../controllers/assetLoan.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/summaries', assetLoanController.getAllSummaries);
router.get('/insights', assetLoanController.getInsights);
router.get('/home-equity', assetLoanController.getHomeEquity);
router.get('/:loanId/amortization', assetLoanController.getAmortization);
router.get('/:loanId/summary', assetLoanController.getSummary);

export default router;
