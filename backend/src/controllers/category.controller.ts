import { Response } from 'express';
import { AuthRequest } from '../types';
import * as categoryService from '../services/category.service';

export async function getCategories(req: AuthRequest, res: Response) {
  const categories = await categoryService.getCategories(req.user!.userId);
  res.json({ success: true, data: categories });
}

export async function createCategory(req: AuthRequest, res: Response) {
  const category = await categoryService.createCategory(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: category });
}

export async function updateCategory(req: AuthRequest, res: Response) {
  const category = await categoryService.updateCategory(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: category });
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  await categoryService.deleteCategory(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Category deleted' });
}
