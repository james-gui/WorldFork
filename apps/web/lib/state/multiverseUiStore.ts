'use client';

import { create } from 'zustand';

interface LayoutPrefs {
  rankdir: 'LR' | 'TB';
  nodeSpacing: number;
  rankSpacing: number;
}

interface MultiverseUIState {
  selectedUniverseId?: string;
  collapsedIds: Set<string>;
  compareSelection: string[];
  highlightLineage: boolean;
  layoutPrefs: LayoutPrefs;
  zoom: number;
  setSelectedUniverseId: (id: string | undefined) => void;
  toggleCollapsed: (id: string) => void;
  setCollapsedIds: (ids: Set<string>) => void;
  addToCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setHighlightLineage: (v: boolean) => void;
  setLayoutPrefs: (prefs: Partial<LayoutPrefs>) => void;
  setZoom: (zoom: number) => void;
}

export const useMultiverseUIStore = create<MultiverseUIState>()((set) => ({
  selectedUniverseId: undefined,
  collapsedIds: new Set<string>(),
  compareSelection: [],
  highlightLineage: false,
  layoutPrefs: {
    rankdir: 'LR',
    nodeSpacing: 24,
    rankSpacing: 80,
  },
  zoom: 1,
  setSelectedUniverseId: (selectedUniverseId) => set({ selectedUniverseId }),
  toggleCollapsed: (id) =>
    set((s) => {
      const next = new Set(s.collapsedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedIds: next };
    }),
  setCollapsedIds: (collapsedIds) => set({ collapsedIds }),
  addToCompare: (id) =>
    set((s) => ({
      compareSelection: s.compareSelection.includes(id)
        ? s.compareSelection
        : [...s.compareSelection, id].slice(-4),
    })),
  toggleCompare: (id) =>
    set((s) => {
      if (s.compareSelection.includes(id)) {
        return { compareSelection: s.compareSelection.filter((x) => x !== id) };
      }
      return {
        compareSelection: [...s.compareSelection, id].slice(-4),
      };
    }),
  removeFromCompare: (id) =>
    set((s) => ({
      compareSelection: s.compareSelection.filter((x) => x !== id),
    })),
  clearCompare: () => set({ compareSelection: [] }),
  setHighlightLineage: (highlightLineage) => set({ highlightLineage }),
  setLayoutPrefs: (prefs) =>
    set((s) => ({ layoutPrefs: { ...s.layoutPrefs, ...prefs } })),
  setZoom: (zoom) => set({ zoom }),
}));
