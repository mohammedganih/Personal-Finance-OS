import { Response } from 'express';
import { AuthRequest } from '../types';
import * as loanService from '../services/loan.service';

export async function getLoans(req: AuthRequest, res: Response) {
  const loans = await loanService.getLoans(req.user!.userId);
  res.json({ success: true, data: loans });
}

export async function getLoanSummary(req: AuthRequest, res: Response) {
  const summary = await loanService.getLoanSummary(req.user!.userId);
  res.json({ success: true, data: summary });
}

export async function createLoan(req: AuthRequest, res: Response) {
  const loan = await loanService.createLoan(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: loan });
}

export async function updateLoan(req: AuthRequest, res: Response) {
  const loan = await loanService.updateLoan(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: loan });
}

export async function deleteLoan(req: AuthRequest, res: Response) {
  await loanService.deleteLoan(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Loan deleted' });
}

export async function payLoanEMI(req: AuthRequest, res: Response) {
  const { accountId } = req.body as { accountId?: string };
  const result = await loanService.payLoanEMI(req.user!.userId, req.params.id, accountId);
  res.json({ success: true, data: result });
}

export async function linkLoanAsset(req: AuthRequest, res: Response) {
  const { investmentId } = req.body as { investmentId: string | null };
  const loan = await loanService.linkLoanAsset(req.user!.userId, req.params.id, investmentId ?? null);
  res.json({ success: true, data: loan });
}
