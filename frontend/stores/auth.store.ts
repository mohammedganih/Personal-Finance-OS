'use client';

import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  // Distinguishes "haven't checked yet" from "checked, not logged in" --
  // the access/refresh tokens are httpOnly cookies now, invisible to JS, so
  // there's no synchronous localStorage read to gate rendering on anymore.
  // Consumers must wait for isInitialized before deciding whether to redirect.
  isInitialized: boolean;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  setUser: (user) => set({ user, isAuthenticated: true, isInitialized: true }),

  logout: () => set({ user: null, isAuthenticated: false, isInitialized: true }),
}));
