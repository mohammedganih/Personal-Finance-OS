'use client';

import { create } from 'zustand';
import { User } from '@/types';
import { saveSession, clearSession, getStoredUser, getToken } from '@/lib/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  initialize: () => {
    const token = getToken();
    const user = getStoredUser();
    if (token && user) {
      set({ user, token, isAuthenticated: true });
    }
  },

  setAuth: (user, token) => {
    saveSession(token, user);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    clearSession();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
