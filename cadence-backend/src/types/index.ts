// ─── Core contract — every signal normalizes to this before scoring ───────────

export type EventSource = 'google_calendar' | 'gmail' | 'manual' | 'webhook' | 'apple_calendar';
export type EventType = 'event' | 'task' | 'notification' | 'email';
export type CognitiveType = 'informational' | 'authorizational' | 'action_bound' | 'conflict';
export type UserActionedState = 'actioned' | 'dismissed' | 'ignored';

export interface CadenceEvent {
  id: string;
  title: string;
  source: EventSource;
  type: EventType;
  timestamp: string;           // ISO 8601
  deadline?: string;           // ISO 8601 — optional
  raw_content?: string;
  tags: string[];
  score: number | null;        // 0–100
  cognitive_type: CognitiveType | null;
  user_actioned: UserActionedState | null;
  created_at: string;
}

// ─── Scoring configuration ───────────────────────────────────────────────────

export interface SourceWeights {
  [key: string]: number;
  google_calendar: number;
  gmail: number;
  manual: number;
  webhook: number;
  apple_calendar: number;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  source_weights: SourceWeights;
  keyword_boosts: string[];
  tag_weights: Record<string, number>;
  surface_threshold: number;
  quiet_hours_start: string;   // 'HH:MM'
  quiet_hours_end: string;     // 'HH:MM'
  digest_time: string;         // 'HH:MM'
  max_foreground_signals: number;
}

// ─── Feedback loop — every user interaction logged ───────────────────────────

export type FeedbackOutcome = 'actioned' | 'dismissed' | 'ignored';

export interface FeedbackEvent {
  id: string;
  cadence_event_id: string;
  outcome: FeedbackOutcome;
  time_to_action_ms?: number;
  timestamp: string;
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface ManualEventInput {
  title: string;
  type: EventType;
  timestamp: string;
  deadline?: string;
  raw_content?: string;
  tags?: string[];
}

export interface FeedbackInput {
  cadence_event_id: string;
  outcome: FeedbackOutcome;
  time_to_action_ms?: number;
}
