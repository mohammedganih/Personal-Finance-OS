import { Router } from 'express';
import * as accountController from '../controllers/account.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAccountSchema, updateAccountSchema } from '../validators/account.validator';

const router = Router();

router.use(authenticate);

router.get('/', accountController.getAccounts);
router.post('/', validate(createAccountSchema), accountController.createAccount);
router.put('/:id', validate(updateAccountSchema), accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

export default router;
