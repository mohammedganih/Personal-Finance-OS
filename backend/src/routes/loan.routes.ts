import { Router } from 'express';
import * as loanController from '../controllers/loan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createLoanSchema, updateLoanSchema } from '../validators/loan.validator';

const router = Router();

router.use(authenticate);

router.get('/', loanController.getLoans);
router.get('/summary', loanController.getLoanSummary);
router.post('/', validate(createLoanSchema), loanController.createLoan);
router.put('/:id', validate(updateLoanSchema), loanController.updateLoan);
router.delete('/:id', loanController.deleteLoan);
router.post('/:id/pay', loanController.payLoanEMI);

export default router;
