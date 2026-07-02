'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { User, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

interface LoginInput { email: string; password: string }
interface RegisterInput { name: string; email: string; password: string }

/** Source of truth for "am I logged in" -- the cookie itself is invisible to
 *  JS, so this is the only way to know. AuthInitializer syncs the result
 *  into useAuthStore so the rest of the app can keep reading it synchronously. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User>>('/auth/me');
      return res.data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await api.post<ApiResponse<{ user: User }>>('/auth/login', data);
      return res.data.data;
    },
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['me'], user);
      router.push('/dashboard');
    },
    onError: () => {
      toast({ title: 'Login failed', description: 'Invalid email or password.', variant: 'destructive' });
    },
  });
}

export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await api.post<ApiResponse<{ user: User }>>('/auth/register', data);
      return res.data.data;
    },
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['me'], user);
      router.push('/dashboard');
    },
    onError: () => {
      toast({ title: 'Registration failed', description: 'Please try again.', variant: 'destructive' });
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const qc = useQueryClient();

  return () => {
    api.post('/auth/logout').finally(() => {
      logout();
      qc.clear(); // don't let a future login on this browser see the previous user's cached data
      router.push('/login');
    });
  };
}
