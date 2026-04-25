'use client';

import { useQuery } from '@tanstack/react-query';

// SoTBundle mirrors the source-of-truth structure from PRD §8
export interface SoTBundle {
  version: string;
  emotions: Array<{ id: string; label: string; description?: string }>;
  behavior_axes: Array<{ id: string; label: string; min: number; max: number }>;
  ideology_axes: Array<{ id: string; label: string; poles: string[] }>;
  expression_scale: Array<{ band: number; label: string; description?: string }>;
  issue_stance_axes: Array<{ id: string; label: string }>;
  event_types: Array<{ id: string; label: string; category: string }>;
  social_action_tools: Array<{ id: string; label: string; parameters: Record<string, unknown> }>;
  channel_types: Array<{ id: string; label: string }>;
  actor_types: Array<{ id: string; label: string }>;
  sociology_parameters: Record<string, unknown>;
}

const MOCK_SOT: SoTBundle = {
  version: '1.0.0',
  emotions: [
    { id: 'anger', label: 'Anger' },
    { id: 'fear', label: 'Fear' },
    { id: 'hope', label: 'Hope' },
    { id: 'pride', label: 'Pride' },
    { id: 'disgust', label: 'Disgust' },
    { id: 'solidarity', label: 'Solidarity' },
    { id: 'anxiety', label: 'Anxiety' },
    { id: 'indifference', label: 'Indifference' },
    { id: 'enthusiasm', label: 'Enthusiasm' },
    { id: 'grief', label: 'Grief' },
    { id: 'shame', label: 'Shame' },
    { id: 'contempt', label: 'Contempt' },
  ],
  behavior_axes: [
    { id: 'aggression', label: 'Aggression', min: 0, max: 1 },
    { id: 'cooperation', label: 'Cooperation', min: 0, max: 1 },
    { id: 'conformity', label: 'Conformity', min: 0, max: 1 },
    { id: 'activism', label: 'Activism', min: 0, max: 1 },
    { id: 'mobilization', label: 'Mobilization', min: 0, max: 1 },
  ],
  ideology_axes: [
    { id: 'economic', label: 'Economic', poles: ['Left', 'Right'] },
    { id: 'social', label: 'Social', poles: ['Progressive', 'Conservative'] },
    { id: 'authority', label: 'Authority', poles: ['Libertarian', 'Authoritarian'] },
    { id: 'nationalism', label: 'Nationalism', poles: ['Globalist', 'Nationalist'] },
    { id: 'environment', label: 'Environment', poles: ['Eco-priority', 'Growth-priority'] },
  ],
  expression_scale: [
    { band: 0, label: 'Silent' },
    { band: 1, label: 'Minimal' },
    { band: 2, label: 'Low' },
    { band: 3, label: 'Moderate' },
    { band: 4, label: 'Active' },
    { band: 5, label: 'Vocal' },
    { band: 6, label: 'Amplified' },
    { band: 7, label: 'Dominant' },
  ],
  issue_stance_axes: [
    { id: 'support', label: 'Support' },
    { id: 'oppose', label: 'Oppose' },
    { id: 'neutral', label: 'Neutral' },
  ],
  event_types: [
    { id: 'protest', label: 'Protest', category: 'collective_action' },
    { id: 'strike', label: 'Strike', category: 'collective_action' },
    { id: 'legislation', label: 'Legislation', category: 'institutional' },
    { id: 'media_story', label: 'Media Story', category: 'information' },
    { id: 'election', label: 'Election', category: 'institutional' },
    { id: 'crisis', label: 'Crisis', category: 'disruption' },
    { id: 'negotiation', label: 'Negotiation', category: 'institutional' },
    { id: 'viral_post', label: 'Viral Post', category: 'information' },
    { id: 'policy_change', label: 'Policy Change', category: 'institutional' },
    { id: 'violence', label: 'Violence', category: 'disruption' },
    { id: 'coalition', label: 'Coalition', category: 'collective_action' },
    { id: 'defection', label: 'Defection', category: 'collective_action' },
  ],
  social_action_tools: [],
  channel_types: [
    { id: 'social_media', label: 'Social Media' },
    { id: 'news', label: 'News Media' },
    { id: 'community', label: 'Community' },
    { id: 'government', label: 'Government' },
  ],
  actor_types: [
    { id: 'cohort', label: 'Cohort' },
    { id: 'hero', label: 'Hero Agent' },
    { id: 'institution', label: 'Institution' },
  ],
  sociology_parameters: {},
};

export function useSourceOfTruth(runId: string) {
  return useQuery<SoTBundle>({
    queryKey: ['sot', runId],
    queryFn: async () => {
      // Will call /api/runs/{runId}/source-of-truth when backend is up.
      // Return mock for now.
      return MOCK_SOT;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
