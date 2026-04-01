import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { getAuthorizedClient } from '../lib/google-auth';

const router = Router();

// ─── POST /apply-action ───────────────────────────────────────────────────────
// Accepts { type, eventId, newStart, newEnd } and patches the event in Google
// Calendar with the proposed new times.

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { type, eventId, newStart, newEnd } = req.body as {
    type?:     string;
    eventId?:  string;
    newStart?: string;
    newEnd?:   string;
  };

  if (!eventId || !newStart || !newEnd) {
    res.status(400).json({ error: 'eventId, newStart, and newEnd are required' });
    return;
  }

  if (type !== 'reschedule' && type !== 'move') {
    res.status(400).json({ error: `Unknown action type: ${type}` });
    return;
  }

  try {
    const auth     = await getAuthorizedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (calendar.events.patch({
      calendarId:  'primary',
      eventId,
      requestBody: {
        start: { dateTime: newStart },
        end:   { dateTime: newEnd },
      },
    }) as any);

    res.json({ success: true, event: result?.data ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[apply-action]', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
