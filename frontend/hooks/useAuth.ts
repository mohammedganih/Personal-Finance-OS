'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { AuthResponse, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

interface LoginInput { email: string; password: string }
interface RegisterInput { name: string; email: string; password: string }

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push('/dashboard');
    },
    onError: () => {
      toast({ title: 'Login failed', description: 'Invalid email or password.', variant: 'destructive' });
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push('/dashboard');
    },
    onError: () => {
      toast({ title: 'Registration failed', description: 'Please try again.', variant: 'destructive' });
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return () => {
    logout();
    router.push('/login');
  };
}
