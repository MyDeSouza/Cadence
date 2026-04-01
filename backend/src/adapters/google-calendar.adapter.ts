import { v4 as uuidv4 } from 'uuid';
import { calendar_v3 } from 'googleapis';
import { AttendeeRecord, CadenceEvent } from '../types';

// ─── Google Calendar adapter ──────────────────────────────────────────────────
// Normalizes a Google Calendar event to the CadenceEvent contract.
// Score and cognitive_type are assigned by the engine after normalization.

/**
 * Parse a Google Calendar date string to a local-timezone Date.
 *
 * Google sends two formats:
 *   dateTime — "2024-04-15T10:00:00-04:00"  (full ISO 8601 — parse normally)
 *   date     — "2024-04-15"                  (all-day, date-only)
 *
 * The spec requires that bare date strings ("YYYY-MM-DD") be parsed as UTC
 * midnight, which shifts all-day events to the previous day for any timezone
 * west of UTC. Fix: split the date components and construct via the local-time
 * Date constructor so the event lands on the correct calendar day.
 */
function parseGCalDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight — no UTC shift
  }
  return new Date(raw);
}

export function adaptGoogleCalendarEvent(
  event: calendar_v3.Schema$Event,
  calendarName?: string
): Omit<CadenceEvent, 'score' | 'cognitive_type'> {
  const startRaw = event.start?.dateTime ?? event.start?.date ?? new Date().toISOString();
  const endRaw   = event.end?.dateTime   ?? event.end?.date;

  console.log(`[GCal sync] "${event.summary}" — raw attendees: ${JSON.stringify(event.attendees ?? null)}`);

  const attendees: AttendeeRecord[] = (event.attendees ?? []).map((a) => ({
    email:     a.email ?? '',
    name:      a.displayName ?? undefined,
    organiser: a.organizer ?? false,
    status:    (a.responseStatus as AttendeeRecord['status']) ?? 'needsAction',
  }));

  let reminder_minutes: number | null = null;
  if (event.reminders?.overrides?.length) {
    reminder_minutes = event.reminders.overrides[0].minutes ?? null;
  } else if (event.reminders?.useDefault) {
    reminder_minutes = 30;
  }

  return {
    id:              event.id ?? uuidv4(),
    title:           (event.summary ?? 'Untitled event').trim(),
    source:          'google_calendar',
    type:            'event',
    timestamp:       parseGCalDate(startRaw).toISOString(),
    deadline:        endRaw ? parseGCalDate(endRaw).toISOString() : undefined,
    raw_content:     event.description?.trim() ?? undefined,
    tags:            calendarName ? [`cal:${calendarName}`] : [],
    user_actioned:   null,
    created_at:      new Date().toISOString(),
    location:        event.location?.trim() ?? null,
    attendees:       attendees.length > 0 ? attendees : null,
    reminder_minutes,
    organiser_email: event.organizer?.email ?? null,
  };
}
