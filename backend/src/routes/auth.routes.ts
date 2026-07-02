import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import { registerSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

// Brute-force prevention: an attacker gets 10 password guesses per IP per
// 15 minutes, not unlimited guesses.
const loginRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  'Too many login attempts. Please try again in 15 minutes.'
);

// Spam-account prevention: looser than login since this isn't a brute-force
// target, just needs to stop automated account farming.
const registerRateLimiter = createRateLimiter(
  60 * 60 * 1000,
  10,
  'Too many accounts created from this location. Please try again later.'
);

router.post('/register', registerRateLimiter, validate(registerSchema), authController.register);
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

export default router;
