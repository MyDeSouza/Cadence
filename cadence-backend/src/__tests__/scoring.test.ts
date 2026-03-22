import { scoreEvent, isInQuietHours, getDeadlineMultiplier } from '../engine/scoring';
import { UserPreferences } from '../types';

const BASE_PREFS: UserPreferences = {
  id: 'test',
  user_id: 'default',
  source_weights: {
    google_calendar: 70,
    gmail: 60,
    manual: 90,
    webhook: 30,
    apple_calendar: 70,
  },
  keyword_boosts: ['urgent', 'deadline', 'RSVP', 'invoice'],
  tag_weights: { work: 20, health: 15, personal: 10, client: 25, finance: 20 },
  surface_threshold: 65,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  digest_time: '08:00',
  max_foreground_signals: 4,
};

const MIDDAY = new Date('2024-01-15T12:00:00Z');

// ─── isInQuietHours ───────────────────────────────────────────────────────────

describe('isInQuietHours', () => {
  it('returns true during overnight quiet window (22:00–07:00)', () => {
    const midnight = new Date('2024-01-15T00:00:00');
    // Force local hour to midnight-ish — test the logic, not timezone
    expect(isInQuietHours(new Date(2024, 0, 15, 0, 30), '22:00', '07:00')).toBe(true);
    expect(isInQuietHours(new Date(2024, 0, 15, 23, 0), '22:00', '07:00')).toBe(true);
  });

  it('returns false during active hours', () => {
    expect(isInQuietHours(new Date(2024, 0, 15, 9, 0), '22:00', '07:00')).toBe(false);
    expect(isInQuietHours(new Date(2024, 0, 15, 14, 0), '22:00', '07:00')).toBe(false);
  });

  it('handles same-day ranges', () => {
    expect(isInQuietHours(new Date(2024, 0, 15, 13, 0), '12:00', '14:00')).toBe(true);
    expect(isInQuietHours(new Date(2024, 0, 15, 11, 0), '12:00', '14:00')).toBe(false);
  });
});

// ─── getDeadlineMultiplier ────────────────────────────────────────────────────

describe('getDeadlineMultiplier', () => {
  const now = MIDDAY;

  it('returns 1.8 for deadlines under 2 hours', () => {
    const deadline = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineMultiplier(deadline, now)).toBe(1.8);
  });

  it('returns 1.8 for overdue deadlines', () => {
    const deadline = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    expect(getDeadlineMultiplier(deadline, now)).toBe(1.8);
  });

  it('returns 1.4 for 2–6 hour deadlines', () => {
    const deadline = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineMultiplier(deadline, now)).toBe(1.4);
  });

  it('returns 1.2 for 6–24 hour deadlines', () => {
    const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineMultiplier(deadline, now)).toBe(1.2);
  });

  it('returns 1.0 for deadlines beyond 24 hours', () => {
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineMultiplier(deadline, now)).toBe(1.0);
  });

  it('returns 1.0 when no deadline', () => {
    expect(getDeadlineMultiplier(undefined, now)).toBe(1.0);
  });
});

// ─── scoreEvent ───────────────────────────────────────────────────────────────

describe('scoreEvent', () => {
  it('manual source gets high base score (90)', () => {
    const score = scoreEvent(
      { source: 'manual', title: 'Simple task', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    expect(score).toBe(90);
  });

  it('webhook source gets low base score (30)', () => {
    const score = scoreEvent(
      { source: 'webhook', title: 'Ping', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    expect(score).toBe(30);
  });

  it('applies keyword boost from title', () => {
    const withBoost = scoreEvent(
      { source: 'gmail', title: 'urgent meeting', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    const withoutBoost = scoreEvent(
      { source: 'gmail', title: 'regular meeting', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    expect(withBoost - withoutBoost).toBe(15);
  });

  it('applies keyword boost from raw_content', () => {
    const score = scoreEvent(
      { source: 'gmail', title: 'Meeting', raw_content: 'Please RSVP', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    expect(score).toBe(75); // 60 + 15
  });

  it('stacks multiple keyword boosts', () => {
    const score = scoreEvent(
      { source: 'gmail', title: 'urgent invoice', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    expect(score).toBe(90); // 60 + 15 + 15
  });

  it('applies tag boosts', () => {
    const withTags = scoreEvent(
      { source: 'gmail', title: 'Meeting', tags: ['work', 'client'] },
      BASE_PREFS,
      MIDDAY
    );
    // 60 (gmail) + 20 (work) + 25 (client) = 105, capped at 100
    expect(withTags).toBe(100);
  });

  it('caps score at 100', () => {
    const score = scoreEvent(
      {
        source: 'manual',
        title: 'urgent deadline invoice',
        raw_content: 'RSVP required',
        tags: ['work', 'client', 'finance'],
        deadline: new Date(MIDDAY.getTime() + 30 * 60 * 1000).toISOString(),
      },
      BASE_PREFS,
      MIDDAY
    );
    expect(score).toBe(100);
  });

  it('returns 0 during quiet hours', () => {
    const quietTime = new Date(2024, 0, 15, 23, 30); // 11:30 PM
    const score = scoreEvent(
      { source: 'manual', title: 'Important task', tags: ['work'] },
      BASE_PREFS,
      quietTime
    );
    expect(score).toBe(0);
  });

  it('applies deadline multiplier correctly', () => {
    const deadline = new Date(MIDDAY.getTime() + 1 * 60 * 60 * 1000).toISOString();
    const scoreWithDeadline = scoreEvent(
      { source: 'google_calendar', title: 'Meeting', tags: [], deadline },
      BASE_PREFS,
      MIDDAY
    );
    const scoreWithout = scoreEvent(
      { source: 'google_calendar', title: 'Meeting', tags: [] },
      BASE_PREFS,
      MIDDAY
    );
    // 70 * 1.8 = 126, capped at 100
    expect(scoreWithDeadline).toBe(100);
    expect(scoreWithout).toBe(70);
  });
});
