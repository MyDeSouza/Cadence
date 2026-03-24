export type CognitiveType =
  | 'authorizational'
  | 'action_bound'
  | 'conflict'
  | 'informational'
  | 'deadline';

export interface Attendee {
  email: string;
  name?: string;
  organiser: boolean;
  status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface CadenceEvent {
  id: string;
  title: string;
  raw_content?: string | null;
  timestamp: string; // ISO 8601
  deadline?: string | null;
  score: number; // 0–100
  cognitive_type: CognitiveType;
  source: string;
  url?: string;
  attendees?: Attendee[] | null;
  surfaced: boolean;
  actioned: boolean;
  location?: string | null;
  reminder_minutes?: number | null;
  organiser_email?: string | null;
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
