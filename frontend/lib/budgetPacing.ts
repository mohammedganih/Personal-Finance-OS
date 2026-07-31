import { getDate, getDaysInMonth } from 'date-fns';
import { Budget } from '@/types';

export interface BudgetForecast {
  budget: Budget;
  paceRatio: number; // >1 means spending faster than the month is passing
  projectedPct: number; // where this category lands as a % of its limit, at the current pace
  projectedOverAmount: number; // rupees over the limit at that projected finish, 0 if not projected over
}

export interface BudgetPacing {
  daysElapsed: number;
  daysInMonth: number;
  elapsedPct: number; // % of the month elapsed
  combinedSpent: number;
  combinedLimit: number;
  combinedBurnPct: number; // % of combined budget spent so far
  isPacingWell: boolean; // burn rate at or under the month's elapsed pace
  forecasts: BudgetForecast[];
  // The single category most worth calling out -- projected to finish over
  // its limit, and by the largest rupee amount among those that are.
  worstOffender: BudgetForecast | null;
}

/**
 * Pure client-side math over fields the Budget type already returns (spent,
 * monthlyLimit) plus today's date -- no backend change needed. Linearly
 * extrapolates each category's current spend rate to a full-month
 * projection, the same idea as computeLoanStats' time-elapsed marker,
 * applied to budgets instead of loan tenure.
 */
export function computeBudgetPacing(budgets: Budget[], now = new Date()): BudgetPacing {
  const daysInMonth = getDaysInMonth(now);
  const daysElapsed = getDate(now);
  const elapsedFraction = daysElapsed / daysInMonth;
  const elapsedPct = elapsedFraction * 100;

  const combinedSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const combinedLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const combinedBurnPct = combinedLimit > 0 ? (combinedSpent / combinedLimit) * 100 : 0;

  const forecasts: BudgetForecast[] = budgets
    .filter((b) => b.monthlyLimit > 0)
    .map((budget) => {
      const spentPct = (budget.spent / budget.monthlyLimit) * 100;
      const paceRatio = elapsedFraction > 0 ? spentPct / elapsedPct : spentPct > 0 ? Infinity : 0;
      const projectedPct = elapsedFraction > 0 ? spentPct / elapsedFraction : spentPct;
      const projectedOverAmount = projectedPct > 100 ? ((projectedPct - 100) / 100) * budget.monthlyLimit : 0;
      return { budget, paceRatio, projectedPct, projectedOverAmount };
    });

  const overPace = forecasts.filter((f) => f.projectedOverAmount > 0);
  const worstOffender = overPace.length > 0
    ? [...overPace].sort((a, b) => b.projectedOverAmount - a.projectedOverAmount)[0]
    : null;

  return {
    daysElapsed, daysInMonth, elapsedPct, combinedSpent, combinedLimit, combinedBurnPct,
    isPacingWell: combinedBurnPct <= elapsedPct,
    forecasts,
    worstOffender,
  };
}
