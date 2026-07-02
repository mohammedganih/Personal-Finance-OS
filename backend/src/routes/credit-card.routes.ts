import { Router } from 'express';
import * as creditCardController from '../controllers/credit-card.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCreditCardSchema, updateCreditCardSchema } from '../validators/credit-card.validator';

const router = Router();
router.use(authenticate);

router.get('/', creditCardController.getCreditCards);
router.post('/', validate(createCreditCardSchema), creditCardController.createCreditCard);
router.put('/:id', validate(updateCreditCardSchema), creditCardController.updateCreditCard);
router.delete('/:id', creditCardController.deleteCreditCard);
router.post('/:id/pay', creditCardController.payCreditCardBill);

export default router;
