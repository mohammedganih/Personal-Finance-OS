import { Router } from 'express';
import * as creditCardController from '../controllers/credit-card.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCreditCardSchema, updateCreditCardSchema } from '../validators/credit-card.validator';
import { payCreditCardBillSchema, saveCardStatementSchema, createCardExpenseSchema, updateCardExpenseSchema } from '@shazah/shared';

const router = Router();
router.use(authenticate);

router.get('/', creditCardController.getCreditCards);
// One-off card purchases (before the /:id routes so "expenses" isn't read as a card id).
router.get('/expenses', creditCardController.getExpenses);
router.post('/expenses', validate(createCardExpenseSchema), creditCardController.createExpense);
router.put('/expenses/:expenseId', validate(updateCardExpenseSchema), creditCardController.updateExpense);
router.delete('/expenses/:expenseId', creditCardController.deleteExpense);
router.post('/expenses/:expenseId/pay', creditCardController.payExpense);
router.post('/expenses/:expenseId/undo-pay', creditCardController.undoExpensePayment);
router.delete('/statements/:statementId', creditCardController.deleteStatement);
router.post('/', validate(createCreditCardSchema), creditCardController.createCreditCard);
router.put('/:id', validate(updateCreditCardSchema), creditCardController.updateCreditCard);
router.delete('/:id', creditCardController.deleteCreditCard);
router.post('/:id/pay', validate(payCreditCardBillSchema), creditCardController.payCreditCardBill);
router.get('/:id/statements', creditCardController.getStatements);
router.post('/:id/statements', validate(saveCardStatementSchema), creditCardController.saveStatement);

export default router;
