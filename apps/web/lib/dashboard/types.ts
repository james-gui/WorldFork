export const EMOTIONS = [
  'Hope',
  'Fear',
  'Anger',
  'Joy',
  'Sadness',
  'Trust',
  'Disgust',
  'Surprise',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_COLORS: Record<Emotion, string> = {
  Hope: '#10b981',
  Fear: '#8b5cf6',
  Anger: '#f43f5e',
  Joy: '#f59e0b',
  Sadness: '#0ea5e9',
  Trust: '#6366f1',
  Disgust: '#64748b',
  Surprise: '#d946ef',
};

export interface SparkPoint {
  i: number;
  v: number;
}

export interface EmotionTrendPoint {
  tick: number;
  Hope: number;
  Fear: number;
  Anger: number;
  Joy: number;
  Sadness: number;
  Trust: number;
  Disgust: number;
  Surprise: number;
}

export interface SocialPost {
  id: string;
  authorName: string;
  authorRole: 'cohort' | 'hero';
  archetype: string;
  avatarColor: string;
  timestamp: string;
  content: string;
  reactions: { kind: string; count: number }[];
}

export interface QueueEvent {
  id: string;
  title: string;
  kind: string;
  inTicks: number;
  intensity: number;
}

export interface CohortMetrics {
  stance: number;
  mood: number;
  trust: number;
  mobilization: number;
  population: number;
  expression: number;
}

export interface CohortDetail {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  metrics: CohortMetrics;
  bars: { label: string; value: number }[];
}

export interface DashboardOverviewData {
  events: QueueEvent[];
  totalUniverses: number;
  branchesPerTick: number;
  multiverseDominant: Emotion;
}
