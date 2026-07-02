import { Router } from 'express';
import * as cardEMIController from '../controllers/card-emi.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCardEMISchema, updateCardEMISchema } from '../validators/card-emi.validator';

const router = Router();
router.use(authenticate);

router.get('/',              cardEMIController.getCardEMIs);
router.get('/summary',       cardEMIController.getSummary);
router.get('/card/:cardId',  cardEMIController.getCardEMIsForCard);
router.post('/',   validate(createCardEMISchema), cardEMIController.createCardEMI);
router.put('/:id', validate(updateCardEMISchema), cardEMIController.updateCardEMI);
router.delete('/:id',        cardEMIController.deleteCardEMI);
router.post('/:id/pay',      cardEMIController.payCardEMI);

export default router;
