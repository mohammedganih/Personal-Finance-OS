import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTransactionSchema, updateTransactionSchema } from '../validators/transaction.validator';

const router = Router();

router.use(authenticate);

router.get('/', transactionController.getTransactions);
router.post('/', validate(createTransactionSchema), transactionController.createTransaction);
router.put('/:id', validate(updateTransactionSchema), transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

export default router;
