'use client';

import { create } from 'zustand';

interface PeriodState {
  // 1-indexed month (1 = January), matching what the API expects
  month: number;
  year: number;
  setPeriod: (month: number, year: number) => void;
  resetToCurrentMonth: () => void;
  isCurrentMonth: () => boolean;
}

function now() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  ...now(),

  setPeriod: (month, year) => set({ month, year }),

  resetToCurrentMonth: () => set(now()),

  isCurrentMonth: () => {
    const current = now();
    return get().month === current.month && get().year === current.year;
  },
}));
