import { Response } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../lib/cookies';

export async function register(req: AuthRequest, res: Response) {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ success: true, data: { user } });
}

export async function login(req: AuthRequest, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true, data: { user } });
}

export async function getMe(req: AuthRequest, res: Response) {
  const user = await authService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
}

export async function refresh(req: AuthRequest, res: Response) {
  const rawRefresh = req.cookies?.[REFRESH_COOKIE];
  if (!rawRefresh) {
    res.status(401).json({ success: false, message: 'No refresh token' });
    return;
  }

  const { accessToken, refreshToken } = await authService.refresh(rawRefresh);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true });
}

export async function logout(req: AuthRequest, res: Response) {
  const rawRefresh = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(rawRefresh);
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out' });
}
