import type { CognitiveType } from '../types';

export const COGNITIVE_COLOURS: Record<CognitiveType, string> = {
  authorizational: '#5B8CF7',
  action_bound:    '#F7C05B',
  conflict:        '#F75B5B',
  informational:   '#B8BEC6',
  deadline:        '#B8BEC6',
};

export const COGNITIVE_LABELS: Record<CognitiveType, string> = {
  authorizational: 'Auth',
  action_bound:    'Action',
  conflict:        'Conflict',
  informational:   'Info',
  deadline:        'Deadline',
};

export const COGNITIVE_DESCRIPTIONS: Record<CognitiveType, string> = {
  authorizational: 'The system has resolved this. It needs your approval.',
  action_bound:    'This requires you to act externally. Acknowledge or defer.',
  conflict:        'Two signals overlap. A decision is needed.',
  informational:   'Awareness only. No action required.',
  deadline:        'A time-bound task is approaching.',
};

export const SOURCE_LABELS: Record<string, string> = {
  google_calendar: 'Google Cal',
  gmail:           'Gmail',
  manual:          'Manual',
  webhook:         'Webhook',
  apple_calendar:  'Apple Cal',
};
