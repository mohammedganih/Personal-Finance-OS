import { Response } from 'express';
import { AuthRequest } from '../types';
import * as p2pService from '../services/p2p.service';

export async function getP2PLoans(req: AuthRequest, res: Response) {
  const loans = await p2pService.getP2PLoans(req.user!.userId);
  res.json({ success: true, data: loans });
}

export async function getP2PSummary(req: AuthRequest, res: Response) {
  const summary = await p2pService.getP2PSummary(req.user!.userId);
  res.json({ success: true, data: summary });
}

export async function createP2PLoan(req: AuthRequest, res: Response) {
  const loan = await p2pService.createP2PLoan(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: loan });
}

export async function updateP2PLoan(req: AuthRequest, res: Response) {
  const loan = await p2pService.updateP2PLoan(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: loan });
}

export async function deleteP2PLoan(req: AuthRequest, res: Response) {
  await p2pService.deleteP2PLoan(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'P2P loan deleted' });
}
