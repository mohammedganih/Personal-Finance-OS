import { differenceInMonths } from 'date-fns';

// No stored field on Goal for this -- derived purely from time-to-target
// using the standard financial-planning convention (short: under a year,
// medium: 1-5 years, long: beyond 5 years), same "derive it, document it"
// approach as the other *Meta.ts helpers added for this redesign.
export const GOAL_TERMS = ['Short Term', 'Mid Term', 'Long Term'] as const;

export type GoalTerm = (typeof GOAL_TERMS)[number];

export function goalTermFor(targetDate: string | Date, now: Date = new Date()): GoalTerm {
  const months = differenceInMonths(new Date(targetDate), now);
  if (months <= 12) return 'Short Term';
  if (months <= 60) return 'Mid Term';
  return 'Long Term';
}
