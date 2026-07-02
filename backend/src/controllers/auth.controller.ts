import { Response } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';

export async function register(req: AuthRequest, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

export async function login(req: AuthRequest, res: Response) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

export async function getMe(req: AuthRequest, res: Response) {
  const user = await authService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
}
