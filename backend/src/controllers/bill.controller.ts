import { Response } from 'express';
import { AuthRequest } from '../types';
import * as billService from '../services/bill.service';

export async function getBills(req: AuthRequest, res: Response) {
  const bills = await billService.getBills(req.user!.userId, {
    status: req.query.status as string | undefined,
    category: req.query.category as string | undefined,
    frequency: req.query.frequency as string | undefined,
    search: req.query.search as string | undefined,
  });
  res.json({ success: true, data: bills });
}

export async function getBill(req: AuthRequest, res: Response) {
  const bill = await billService.getBill(req.user!.userId, req.params.id);
  res.json({ success: true, data: bill });
}

export async function getBillReminders(req: AuthRequest, res: Response) {
  const reminders = await billService.getBillReminders(req.user!.userId);
  res.json({ success: true, data: reminders });
}

export async function createBill(req: AuthRequest, res: Response) {
  const bill = await billService.createBill(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: bill });
}

export async function updateBill(req: AuthRequest, res: Response) {
  const bill = await billService.updateBill(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: bill });
}

export async function deleteBill(req: AuthRequest, res: Response) {
  await billService.deleteBill(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Bill deleted' });
}

export async function duplicateBill(req: AuthRequest, res: Response) {
  const bill = await billService.duplicateBill(req.user!.userId, req.params.id);
  res.status(201).json({ success: true, data: bill });
}

export async function pauseBill(req: AuthRequest, res: Response) {
  const bill = await billService.pauseBill(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: bill });
}

export async function resumeBill(req: AuthRequest, res: Response) {
  const bill = await billService.resumeBill(req.user!.userId, req.params.id);
  res.json({ success: true, data: bill });
}

export async function payOccurrence(req: AuthRequest, res: Response) {
  const occurrence = await billService.payOccurrence(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: occurrence });
}

export async function skipOccurrence(req: AuthRequest, res: Response) {
  const occurrence = await billService.skipOccurrence(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: occurrence });
}

export async function undoOccurrence(req: AuthRequest, res: Response) {
  await billService.undoOccurrence(req.user!.userId, req.params.id, req.body.dueDate);
  res.json({ success: true, message: 'Occurrence reverted' });
}

export async function bulkAction(req: AuthRequest, res: Response) {
  const result = await billService.bulkAction(req.user!.userId, req.body);
  res.json({ success: true, data: result });
}
