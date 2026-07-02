import { Router } from 'express';
import * as p2pController from '../controllers/p2p.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createP2PSchema, updateP2PSchema } from '../validators/p2p.validator';

const router = Router();
router.use(authenticate);

router.get('/', p2pController.getP2PLoans);
router.get('/summary', p2pController.getP2PSummary);
router.post('/', validate(createP2PSchema), p2pController.createP2PLoan);
router.put('/:id', validate(updateP2PSchema), p2pController.updateP2PLoan);
router.delete('/:id', p2pController.deleteP2PLoan);

export default router;
