'use client';

import { create } from 'zustand';

interface ReviewUIState {
  tick: number;
  paused: boolean;
  showRationale: boolean;
  setTick: (tick: number) => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setShowRationale: (v: boolean) => void;
}

export const useReviewUIStore = create<ReviewUIState>()((set) => ({
  tick: 0,
  paused: true,
  showRationale: true,
  setTick: (tick) => set({ tick }),
  setPaused: (paused) => set({ paused }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setShowRationale: (showRationale) => set({ showRationale }),
}));
