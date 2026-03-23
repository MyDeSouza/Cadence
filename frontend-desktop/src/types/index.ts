export type CognitiveType =
  | 'authorizational'
  | 'action_bound'
  | 'conflict'
  | 'informational'
  | 'deadline';

export interface CadenceEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string; // ISO 8601
  score: number; // 0–100
  cognitive_type: CognitiveType;
  source: string;
  url?: string;
  attendees?: string[];
  surfaced: boolean;
  actioned: boolean;
}

export interface DigestResponse {
  date: string;
  events: CadenceEvent[];
  total_surfaced: number;
}

export interface SurfacedResponse {
  events: CadenceEvent[];
  count: number;
}

export interface ActiveSession {
  event: CadenceEvent;
  startedAt: Date;
}

export type SessionStatus = 'idle' | 'active';

export type TonePosition = {
  label: 'Formal' | 'Professional' | 'Neutral' | 'Casual' | 'Direct';
  x: number; // 0–1, Concise → Detailed
  y: number; // 0–1, Warm → Clinical
};
