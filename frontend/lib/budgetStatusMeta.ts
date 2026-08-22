import { BudgetStatus } from '@/types';

// Same thresholds as backend/src/services/budget.service.ts's
// calculateBudgetProgress (over >=100%, near >=80%, else under) -- this
// just maps that already-real status to a label/color, not a new rule.
export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  under: 'On Track',
  near: 'Watch Out',
  over: 'Over Budget',
};

export const BUDGET_STATUS_COLOR: Record<BudgetStatus, string> = {
  under: '#0CA30C',
  near: '#B45309',
  over: '#D03B3B',
};
