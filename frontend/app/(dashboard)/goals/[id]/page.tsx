'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Pencil, Trash2, LayoutDashboard, TrendingUp, GitBranch, Lightbulb, Trophy, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoal, useDeleteGoal } from '@/hooks/useGoals';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalOverviewTab } from '@/components/goals/GoalOverviewTab';
import { GoalProgressTab } from '@/components/goals/GoalProgressTab';
import { GoalScenariosTab } from '@/components/goals/GoalScenariosTab';
import { GoalRecommendationsTab } from '@/components/goals/GoalRecommendationsTab';
import { GoalMilestonesTab } from '@/components/goals/GoalMilestonesTab';
import { GoalContributionsTab } from '@/components/goals/GoalContributionsTab';
import { GOAL_TYPE_LABELS, GOAL_TYPE_ICONS, GOAL_PRIORITY_LABELS } from '@/lib/constants';
import { GoalPriority } from '@/types';
import { useRouter } from 'next/navigation';

const PRIORITY_BADGE: Record<GoalPriority, 'danger' | 'warning' | 'default' | 'secondary'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'default', LOW: 'secondary',
};

export default function GoalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: goal, isLoading } = useGoal(params.id);
  const { mutate: deleteGoal } = useDeleteGoal();
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading || !goal) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded-lg shimmer" />
        <div className="h-32 rounded-2xl shimmer" />
        <div className="h-96 rounded-2xl shimmer" />
      </div>
    );
  }

  const handleDelete = () => {
    deleteGoal(goal.id, { onSuccess: () => router.push('/goals') });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/goals" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Goals
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: goal.color ? `${goal.color}20` : 'rgba(124,58,237,0.1)' }}
          >
            {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{goal.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-text-secondary">{GOAL_TYPE_LABELS[goal.goalType]}</span>
              <Badge variant={PRIORITY_BADGE[goal.priority]}>{GOAL_PRIORITY_LABELS[goal.priority]}</Badge>
              {goal.isCompleted && <Badge variant="success">Completed</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><LayoutDashboard className="w-3.5 h-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="progress"><TrendingUp className="w-3.5 h-3.5" />Progress</TabsTrigger>
          <TabsTrigger value="scenarios"><GitBranch className="w-3.5 h-3.5" />Scenarios</TabsTrigger>
          <TabsTrigger value="recommendations"><Lightbulb className="w-3.5 h-3.5" />Recommendations</TabsTrigger>
          <TabsTrigger value="milestones"><Trophy className="w-3.5 h-3.5" />Milestones</TabsTrigger>
          <TabsTrigger value="contributions"><Receipt className="w-3.5 h-3.5" />Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><GoalOverviewTab goal={goal} /></TabsContent>
        <TabsContent value="progress"><GoalProgressTab goal={goal} /></TabsContent>
        <TabsContent value="scenarios"><GoalScenariosTab goalId={goal.id} /></TabsContent>
        <TabsContent value="recommendations"><GoalRecommendationsTab goalId={goal.id} /></TabsContent>
        <TabsContent value="milestones"><GoalMilestonesTab goalId={goal.id} /></TabsContent>
        <TabsContent value="contributions"><GoalContributionsTab goalId={goal.id} /></TabsContent>
      </Tabs>

      {showEdit && <GoalForm goal={goal} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
