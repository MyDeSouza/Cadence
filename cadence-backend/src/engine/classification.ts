import { CadenceEvent, CognitiveType } from '../types';

// ─── Conflict detection ───────────────────────────────────────────────────────
// Two events conflict if they are both of type 'event' and overlap in time.

function doEventsOverlap(a: Pick<CadenceEvent, 'timestamp' | 'deadline'>, b: Pick<CadenceEvent, 'timestamp' | 'deadline'>): boolean {
  const aStart = new Date(a.timestamp).getTime();
  const aEnd = a.deadline ? new Date(a.deadline).getTime() : aStart;
  const bStart = new Date(b.timestamp).getTime();
  const bEnd = b.deadline ? new Date(b.deadline).getTime() : bStart;

  return aStart < bEnd && bStart < aEnd;
}

// ─── Classification rules ─────────────────────────────────────────────────────
// Applied after scoring. Determines how the signal is presented and what
// interaction it requires.

export function classifyEvent(
  event: Pick<CadenceEvent, 'score' | 'type' | 'timestamp' | 'deadline'>,
  allEvents: Array<Pick<CadenceEvent, 'id' | 'score' | 'type' | 'timestamp' | 'deadline'>> = []
): CognitiveType {
  const score = event.score ?? 0;

  // Low-score signals — awareness only, no action required
  if (score < 40) return 'informational';

  // Conflict — two calendar events overlap
  if (event.type === 'event') {
    const hasConflict = allEvents.some(
      (other) =>
        other.type === 'event' &&
        other.timestamp !== event.timestamp && // not self
        doEventsOverlap(event, other)
    );
    if (hasConflict) return 'conflict';
  }

  // Action-bound — tasks require external action the system cannot complete
  if (event.type === 'task') return 'action_bound';

  // Default for high-score events — system proposes, user confirms
  return 'authorizational';
}
