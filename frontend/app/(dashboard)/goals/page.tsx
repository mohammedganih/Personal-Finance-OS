'use client';

import { StatsRowGoals } from '@/components/goals/light/StatsRowGoals';
import { GoalsTable } from '@/components/goals/light/GoalsTable';
import { OverallGoalProgressLight } from '@/components/goals/light/OverallGoalProgressLight';
import { GoalTimelineCard } from '@/components/goals/light/GoalTimelineCard';
import { GoalInsightsLight } from '@/components/goals/light/GoalInsightsLight';

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
