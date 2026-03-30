import { v4 as uuidv4 } from 'uuid';
import { AttendeeRecord, CadenceEvent } from '../types';

// ─── Microsoft Calendar adapter ───────────────────────────────────────────────
// Normalizes a Microsoft Graph Calendar event to the CadenceEvent contract.
// Score and cognitive_type are assigned by the engine after normalization.

// Microsoft Graph event shape (subset we care about)
interface MSGraphEvent {
  id?: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
    status?: { response?: string };
    type?: string;
  }>;
  organizer?: { emailAddress?: { address?: string; name?: string } };
  reminderMinutesBeforeStart?: number;
  isReminderOn?: boolean;
  createdDateTime?: string;
}

export function adaptMicrosoftCalendarEvent(
  event: MSGraphEvent
): Omit<CadenceEvent, 'score' | 'cognitive_type'> {
  const startRaw = event.start?.dateTime ?? new Date().toISOString();
  const endRaw   = event.end?.dateTime;

  console.log(`[MSCal sync] "${event.subject}" — raw attendees: ${JSON.stringify(event.attendees ?? null)}`);

  const attendees: AttendeeRecord[] = (event.attendees ?? []).map((a) => {
    // Microsoft response values: none, organizer, tentativelyAccepted, accepted, declined, notResponded
    const msStatus = a.status?.response ?? 'none';
    const statusMap: Record<string, AttendeeRecord['status']> = {
      accepted:            'accepted',
      declined:            'declined',
      tentativelyAccepted: 'tentative',
      none:                'needsAction',
      notResponded:        'needsAction',
      organizer:           'accepted',
    };

    return {
      email:     a.emailAddress?.address ?? '',
      name:      a.emailAddress?.name ?? undefined,
      organiser: a.type === 'required' && a.emailAddress?.address === event.organizer?.emailAddress?.address,
      status:    statusMap[msStatus] ?? 'needsAction',
    };
  });

  let reminder_minutes: number | null = null;
  if (event.isReminderOn && event.reminderMinutesBeforeStart != null) {
    reminder_minutes = event.reminderMinutesBeforeStart;
  }

  return {
    id:              event.id ?? uuidv4(),
    title:           (event.subject ?? 'Untitled event').trim(),
    source:          'microsoft_calendar',
    type:            'event',
    timestamp:       new Date(startRaw).toISOString(),
    deadline:        endRaw ? new Date(endRaw).toISOString() : undefined,
    raw_content:     event.body?.content?.trim() ?? undefined,
    tags:            [],
    user_actioned:   null,
    created_at:      new Date().toISOString(),
    location:        event.location?.displayName?.trim() ?? null,
    attendees:       attendees.length > 0 ? attendees : null,
    reminder_minutes,
    organiser_email: event.organizer?.emailAddress?.address ?? null,
  };
}
