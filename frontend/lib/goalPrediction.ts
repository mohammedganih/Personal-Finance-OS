import { Goal, GoalProgress } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * The plain-language sentence a screen reader (and everyone else) gets as
 * the accessible summary of a goal's hero -- "on pace" or "short by X/mo",
 * never just a ring angle. Shared between the list card and the detail
 * hero so the same goal never tells two different stories.
 */
export function goalPredictionSentence(goal: Goal, progress: GoalProgress): string {
  if (!progress.expectedFinishDate) {
    return "At your current pace, this goal won't complete — increase contributions to set a real finish date.";
  }

  const expected = formatDate(progress.expectedFinishDate, 'MMM yyyy');
  const target = formatDate(goal.targetDate, 'MMM yyyy');

  if (progress.savingsGap <= 0) {
    return expected === target
      ? `On pace for ${expected} — right on your target.`
      : `On pace for ${expected} — ahead of your ${target} target.`;
  }

  return `You're ${formatCurrency(progress.savingsGap, 'INR', true)}/mo short of pace — closing that hits your ${target} target instead of ${expected}.`;
}
