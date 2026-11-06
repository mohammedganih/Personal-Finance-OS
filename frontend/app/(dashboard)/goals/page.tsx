'use client';

import { StatsRowGoals } from '@/components/goals/StatsRowGoals';
import { GoalsTable } from '@/components/goals/GoalsTable';
import { OverallGoalProgressLight } from '@/components/goals/OverallGoalProgressLight';
import { GoalTimelineCard } from '@/components/goals/GoalTimelineCard';
import { GoalInsightsLight } from '@/components/goals/GoalInsightsLight';

export default function GoalsPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowGoals />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <GoalsTable />
        </div>
        <div className="space-y-4">
          <OverallGoalProgressLight />
          <GoalTimelineCard />
          <GoalInsightsLight />
        </div>
      </div>
    </div>
  );
}
