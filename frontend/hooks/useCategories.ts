'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Category, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>('/categories');
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Category added' });
    },
    onError: () => toast({ title: 'Failed to add category', variant: 'destructive' }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/categories/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Category updated' });
    },
    onError: () => toast({ title: 'Failed to update category', variant: 'destructive' }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Category deleted' });
    },
    onError: () => toast({ title: 'Failed to delete category', variant: 'destructive' }),
  });
}
