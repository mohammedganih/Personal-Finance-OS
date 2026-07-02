import { Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { AuthRequest } from '../types';
import { ACCESS_COOKIE } from '../lib/cookies';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (!token) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
