'use client';

import { create } from 'zustand';

interface DashboardUIState {
  currentTickScrub?: number;
  autoplay: boolean;
  playbackSpeed: number;
  pinnedCohortId?: string;
  setCurrentTickScrub: (tick: number | undefined) => void;
  setAutoplay: (autoplay: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPinnedCohortId: (id: string | undefined) => void;
}

export const useDashboardUIStore = create<DashboardUIState>()((set) => ({
  currentTickScrub: undefined,
  autoplay: true,
  playbackSpeed: 1,
  pinnedCohortId: undefined,
  setCurrentTickScrub: (currentTickScrub) => set({ currentTickScrub }),
  setAutoplay: (autoplay) => set({ autoplay }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setPinnedCohortId: (pinnedCohortId) => set({ pinnedCohortId }),
}));
