import { Response } from 'express';
import { AuthRequest } from '../types';
import * as accountService from '../services/account.service';

export async function getAccounts(req: AuthRequest, res: Response) {
  const accounts = await accountService.getAccounts(req.user!.userId);
  res.json({ success: true, data: accounts });
}

export async function createAccount(req: AuthRequest, res: Response) {
  const account = await accountService.createAccount(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: account });
}

export async function updateAccount(req: AuthRequest, res: Response) {
  const account = await accountService.updateAccount(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: account });
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  await accountService.deleteAccount(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Account deleted' });
}
