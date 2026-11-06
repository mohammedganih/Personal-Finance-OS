'use client';

import { create } from 'zustand';

/** The sidebar drawer on narrow screens (on wide screens the sidebar is always shown). */
interface NavState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
