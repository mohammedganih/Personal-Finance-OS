'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Goal, GoalContribution, GoalProgress, GoalProbability, GoalScenario,
  GoalMilestone, GoalRecommendation, GoalInsight, ApiResponse,
} from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Goal[]>>('/goals');
      return res.data.data;
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: ['goals', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Goal>>(`/goals/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useGoalInsights() {
  return useQuery({
    queryKey: ['goals', 'insights'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalInsight[]>>('/goals/insights');
      return res.data.data;
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/goals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal created' }); },
    onError: () => toast({ title: 'Failed to create goal', variant: 'destructive' }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/goals/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal updated' }); },
    onError: () => toast({ title: 'Failed to update goal', variant: 'destructive' }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal deleted' }); },
    onError: () => toast({ title: 'Failed to delete goal', variant: 'destructive' }),
  });
}

// ── Intelligence ─────────────────────────────────────────────────────────────

export function useGoalProgress(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'progress'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalProgress>>(`/goals/${goalId}/progress`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

export function useGoalProbability(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'probability'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalProbability>>(`/goals/${goalId}/probability`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

export function useGoalScenarios(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'scenarios'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalScenario[]>>(`/goals/${goalId}/scenarios`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

export function useGoalMilestones(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'milestones'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalMilestone[]>>(`/goals/${goalId}/milestones`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

export function useGoalRecommendations(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'recommendations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalRecommendation[]>>(`/goals/${goalId}/recommendations`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

// ── Contributions ────────────────────────────────────────────────────────────

export function useGoalContributions(goalId: string) {
  return useQuery({
    queryKey: ['goals', goalId, 'contributions'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<GoalContribution[]>>(`/goals/${goalId}/contributions`);
      return res.data.data;
    },
    enabled: !!goalId,
  });
}

function invalidateGoalQueries(qc: ReturnType<typeof useQueryClient>, goalId: string) {
  qc.invalidateQueries({ queryKey: ['goals'] });
  qc.invalidateQueries({ queryKey: ['goals', goalId] });
}

export function useCreateGoalContribution(goalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/goals/${goalId}/contributions`, data),
    onSuccess: () => { invalidateGoalQueries(qc, goalId); toast({ title: 'Contribution logged' }); },
    onError: () => toast({ title: 'Failed to log contribution', variant: 'destructive' }),
  });
}

export function useDeleteGoalContribution(goalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (contributionId: string) => api.delete(`/goals/${goalId}/contributions/${contributionId}`),
    onSuccess: () => { invalidateGoalQueries(qc, goalId); toast({ title: 'Contribution removed' }); },
    onError: () => toast({ title: 'Failed to remove contribution', variant: 'destructive' }),
  });
}
