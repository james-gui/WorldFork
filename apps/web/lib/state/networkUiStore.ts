'use client';

import { create } from 'zustand';

export type NetworkLayer =
  | 'exposure'
  | 'trust'
  | 'dependency'
  | 'mobilization'
  | 'identity';

export interface CohortAttributeFilters {
  analyticalDepth: number;
  trust: number;
  expressionLevel: number;
  mobilizationCapacity: number;
}

export interface CohortStanceRange {
  min: number; // -1..1
  max: number;
}

interface NetworkUIState {
  activeLayer: NetworkLayer;
  sliderFilters: CohortAttributeFilters;
  cohortStanceRange: CohortStanceRange;
  showEdgesThreshold: number; // 0..1
  computeNeighbors: boolean;
  selectedTick: string; // 'latest' or numeric tick range
  selectedNodeId?: string;

  setActiveLayer: (layer: NetworkLayer) => void;
  setSliderFilter: (key: keyof CohortAttributeFilters, value: number) => void;
  setCohortStanceRange: (range: CohortStanceRange) => void;
  setShowEdgesThreshold: (v: number) => void;
  setComputeNeighbors: (v: boolean) => void;
  setSelectedTick: (t: string) => void;
  setSelectedNodeId: (id: string | undefined) => void;
  resetFilters: () => void;
}

const DEFAULT_SLIDERS: CohortAttributeFilters = {
  analyticalDepth: 0.5,
  trust: 0.5,
  expressionLevel: 0.5,
  mobilizationCapacity: 0.5,
};

const DEFAULT_STANCE: CohortStanceRange = { min: -1, max: 1 };

export const useNetworkUIStore = create<NetworkUIState>()((set) => ({
  activeLayer: 'exposure',
  sliderFilters: DEFAULT_SLIDERS,
  cohortStanceRange: DEFAULT_STANCE,
  showEdgesThreshold: 0.2,
  computeNeighbors: true,
  selectedTick: 'latest',
  selectedNodeId: undefined,

  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setSliderFilter: (key, value) =>
    set((s) => ({ sliderFilters: { ...s.sliderFilters, [key]: value } })),
  setCohortStanceRange: (cohortStanceRange) => set({ cohortStanceRange }),
  setShowEdgesThreshold: (showEdgesThreshold) => set({ showEdgesThreshold }),
  setComputeNeighbors: (computeNeighbors) => set({ computeNeighbors }),
  setSelectedTick: (selectedTick) => set({ selectedTick }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  resetFilters: () =>
    set({
      sliderFilters: DEFAULT_SLIDERS,
      cohortStanceRange: DEFAULT_STANCE,
      showEdgesThreshold: 0.2,
      computeNeighbors: true,
      selectedTick: 'latest',
    }),
}));
