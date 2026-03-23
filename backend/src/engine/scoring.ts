import { CadenceEvent, UserPreferences } from '../types';

// ─── Deadline urgency multipliers ────────────────────────────────────────────

const DEADLINE_MULTIPLIERS = {
  TWO_HOURS: 1.8,
  SIX_HOURS: 1.4,
  TWENTY_FOUR_HOURS: 1.2,
  BEYOND: 1.0,
} as const;

function getDeadlineMultiplier(deadline: string | undefined, now: Date): number {
  if (!deadline) return DEADLINE_MULTIPLIERS.BEYOND;

  const deadlineMs = new Date(deadline).getTime() - now.getTime();
  const hours = deadlineMs / (1000 * 60 * 60);

  if (hours < 0) return DEADLINE_MULTIPLIERS.TWO_HOURS; // already overdue — treat as most urgent
  if (hours < 2) return DEADLINE_MULTIPLIERS.TWO_HOURS;
  if (hours < 6) return DEADLINE_MULTIPLIERS.SIX_HOURS;
  if (hours < 24) return DEADLINE_MULTIPLIERS.TWENTY_FOUR_HOURS;
  return DEADLINE_MULTIPLIERS.BEYOND;
}

// ─── Quiet hours check ───────────────────────────────────────────────────────

function isInQuietHours(
  now: Date,
  quietStart: string, // 'HH:MM'
  quietEnd: string    // 'HH:MM'
): boolean {
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight ranges (e.g. 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ─── Core scoring formula ─────────────────────────────────────────────────────
// Priority Score = Category Weight × Severity Score × Context Multiplier
//
// Broken into additive components for debuggability, then multiplied by deadline.

export function scoreEvent(
  event: Pick<CadenceEvent, 'source' | 'title' | 'raw_content' | 'tags' | 'deadline'>,
  prefs: UserPreferences,
  now: Date = new Date()
): number {
  // Quiet hours — score is 0, signal suppressed until window ends
  if (isInQuietHours(now, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
    return 0;
  }

  // 1. Base score from source weight
  const baseScore = prefs.source_weights[event.source] ?? 50;

  // 2. Keyword boost — check title and raw_content
  const searchText = [event.title, event.raw_content ?? '']
    .join(' ')
    .toLowerCase();

  const keywordBoost = prefs.keyword_boosts.reduce((acc, kw) => {
    return searchText.includes(kw.toLowerCase()) ? acc + 15 : acc;
  }, 0);

  // 3. Tag boost — sum weights of matching tags
  const tagBoost = event.tags.reduce((acc, tag) => {
    return acc + (prefs.tag_weights[tag] ?? 0);
  }, 0);

  // 4. Deadline urgency multiplier
  const multiplier = getDeadlineMultiplier(event.deadline, now);

  // Final score — capped at 100
  const raw = (baseScore + keywordBoost + tagBoost) * multiplier;
  return Math.min(100, Math.round(raw * 10) / 10);
}

export { isInQuietHours, getDeadlineMultiplier };
