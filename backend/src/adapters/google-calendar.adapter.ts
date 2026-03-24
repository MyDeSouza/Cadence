import { v4 as uuidv4 } from 'uuid';
import { calendar_v3 } from 'googleapis';
import { AttendeeRecord, CadenceEvent } from '../types';

// ─── Google Calendar adapter ──────────────────────────────────────────────────
// Normalizes a Google Calendar event to the CadenceEvent contract.
// Score and cognitive_type are assigned by the engine after normalization.

export function adaptGoogleCalendarEvent(
  event: calendar_v3.Schema$Event
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
    timestamp:       new Date(startRaw).toISOString(),
    deadline:        endRaw ? new Date(endRaw).toISOString() : undefined,
    raw_content:     event.description?.trim() ?? undefined,
    tags:            [],
    user_actioned:   null,
    created_at:      new Date().toISOString(),
    location:        event.location?.trim() ?? null,
    attendees:       attendees.length > 0 ? attendees : null,
    reminder_minutes,
    organiser_email: event.organizer?.email ?? null,
  };
}
