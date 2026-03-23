import { classifyEvent } from '../engine/classification';

const BASE_TIME = '2024-01-15T12:00:00.000Z';
const LATER = '2024-01-15T13:00:00.000Z';
const MUCH_LATER = '2024-01-15T18:00:00.000Z';

describe('classifyEvent', () => {
  it('classifies score < 40 as informational', () => {
    expect(classifyEvent({ score: 30, type: 'email', timestamp: BASE_TIME, deadline: undefined })).toBe('informational');
    expect(classifyEvent({ score: 0, type: 'event', timestamp: BASE_TIME, deadline: LATER })).toBe('informational');
  });

  it('classifies overlapping events as conflict', () => {
    const event = { score: 75, type: 'event' as const, timestamp: BASE_TIME, deadline: LATER };
    const other = [
      {
        id: 'other-1',
        score: 80,
        type: 'event' as const,
        timestamp: '2024-01-15T12:30:00.000Z',
        deadline: '2024-01-15T13:30:00.000Z',
      },
    ];
    expect(classifyEvent(event, other)).toBe('conflict');
  });

  it('does not flag conflict for non-overlapping events', () => {
    const event = { score: 75, type: 'event' as const, timestamp: BASE_TIME, deadline: LATER };
    const other = [
      {
        id: 'other-2',
        score: 80,
        type: 'event' as const,
        timestamp: MUCH_LATER,
        deadline: '2024-01-15T19:00:00.000Z',
      },
    ];
    expect(classifyEvent(event, other)).toBe('authorizational');
  });

  it('classifies tasks as action_bound', () => {
    expect(classifyEvent({ score: 75, type: 'task', timestamp: BASE_TIME, deadline: LATER })).toBe('action_bound');
  });

  it('defaults high-score non-task events to authorizational', () => {
    expect(classifyEvent({ score: 80, type: 'email', timestamp: BASE_TIME, deadline: undefined })).toBe('authorizational');
    expect(classifyEvent({ score: 70, type: 'notification', timestamp: BASE_TIME, deadline: undefined })).toBe('authorizational');
  });
});
