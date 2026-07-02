import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters {
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface DashboardOverview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  investmentValue: number;
  debtRatio: number;
  totalSubscriptionCost: number;
  remainingSafeToSave: number;
  monthlyInvestmentCommitment: number;
  actualInvestmentSpent: number;
  actualSubscriptionSpent: number;
  actualEMISpent: number;
  otherExpenses: number;
  effectiveSubscriptionSpent: number;
  effectiveInvestmentSpent: number;
  effectiveEMISpent: number;
}

export interface CashflowData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string | null;
  icon: string | null;
  total: number;
  percentage: number;
  count: number;
}

export interface QuickInsight {
  type: 'increase' | 'decrease' | 'neutral' | 'positive';
  message: string;
  icon: string;
}
