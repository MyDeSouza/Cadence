import { Router, Request, Response } from 'express';
import http from 'http';
import { google } from 'googleapis';
import prisma from '../db';
import { getAuthorizedClient } from '../lib/google-auth';

const router = Router();

const OLLAMA_HOST  = 'localhost';
const OLLAMA_PORT  = 11434;
const OLLAMA_MODEL = 'mistral';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Slot { start: Date; end: Date }

/** True if two time intervals overlap (exclusive end boundary). */
function overlaps(a: Slot, b: Slot): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Given a proposed slot and a list of busy slots, find the earliest available
 * slot of the same duration. Advances past blocking events one at a time.
 * Returns null if no slot fits before workDayEnd.
 */
function resolveSlot(proposed: Slot, busy: Slot[], workDayEnd: Date): Slot | null {
  const duration = proposed.end.getTime() - proposed.start.getTime();
  let candidate: Slot = { start: new Date(proposed.start), end: new Date(proposed.end) };

  // Cap iterations to prevent an infinite loop on pathological input
  for (let i = 0; i < 48; i++) {
    if (candidate.end > workDayEnd) return null;

    const blocker = busy.find((b) => overlaps(candidate, b));
    if (!blocker) return candidate;   // free slot found

    // Advance start to the end of the blocking event
    const newStart = new Date(blocker.end.getTime());
    candidate = { start: newStart, end: new Date(newStart.getTime() + duration) };
  }

  return null;
}

function callOllama(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false });

    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port:     OLLAMA_PORT,
        path:     '/api/generate',
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { response?: string };
            resolve(parsed.response ?? '');
          } catch {
            reject(new Error('Failed to parse Ollama response'));
          }
        });
        res.on('error', reject);
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── POST /plan-tomorrow ──────────────────────────────────────────────────────

router.post('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now           = new Date();
    const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfTomorrow   = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

    // ── 1. Today's signals — actioned and pending ─────────────────────────────
    const todaySignals = await prisma.cadenceEvent.findMany({
      where: {
        OR: [
          { timestamp: { gte: startOfToday, lt: startOfTomorrow } },
          { deadline:  { gte: startOfToday, lt: startOfTomorrow } },
        ],
      },
      orderBy: { timestamp: 'asc' },
    });

    const actioned = todaySignals.filter((e) => e.user_actioned !== null);
    const pending  = todaySignals.filter((e) => e.user_actioned === null);

    // ── 2. Tomorrow's existing calendar events (to find open slots) ───────────
    const auth     = await getAuthorizedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const tomorrowResp = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      startOfTomorrow.toISOString(),
      timeMax:      endOfTomorrow.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   50,
    });

    const existingTomorrow = (tomorrowResp.data.items ?? []).map((e) => ({
      title: e.summary ?? 'Untitled',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end:   e.end?.dateTime   ?? e.end?.date   ?? '',
    }));

    // ── 3. Build Ollama prompt ────────────────────────────────────────────────
    const actionedLines = actioned.length > 0
      ? actioned.map((e) => `- "${e.title}"`).join('\n')
      : 'None';

    const pendingLines = pending.length > 0
      ? pending.map((e) => `- "${e.title}" [${e.cognitive_type ?? 'informational'}]`).join('\n')
      : 'None';

    const existingLines = existingTomorrow.length > 0
      ? existingTomorrow.map((e) => `- "${e.title}" from ${e.start} to ${e.end}`).join('\n')
      : 'None';

    const tomorrowDateStr = startOfTomorrow.toISOString().slice(0, 10);

    const prompt =
      `You are a scheduling assistant. Based on what was completed today and what is still pending, generate a schedule for tomorrow. ` +
      `Output ONLY a JSON array of events, each with: title, startTime (ISO 8601), endTime (ISO 8601), and description. ` +
      `No explanation, no preamble, just the JSON array.\n\n` +
      `Today: ${now.toISOString().slice(0, 10)}\n` +
      `Tomorrow: ${tomorrowDateStr}\n\n` +
      `Completed today:\n${actionedLines}\n\n` +
      `Still pending:\n${pendingLines}\n\n` +
      `Already scheduled tomorrow:\n${existingLines}\n\n` +
      `Schedule pending items into available slots tomorrow. Work hours 09:00–18:00. Avoid conflicts with already-scheduled events.`;

    // ── 4. Call Ollama (non-streaming) ────────────────────────────────────────
    const raw = await callOllama(prompt);

    // ── 5. Extract JSON array from the model's response ───────────────────────
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      res.status(502).json({ error: 'Model did not return a valid schedule', raw });
      return;
    }

    const proposed = JSON.parse(jsonMatch[0]) as Array<{
      title:       string;
      startTime:   string;
      endTime:     string;
      description: string;
    }>;

    // ── 6. Conflict-aware scheduling + create in Google Calendar ─────────────
    // Work day ends at 21:00 tomorrow (allows evening slots up to 9 pm)
    const workDayEnd = new Date(startOfTomorrow);
    workDayEnd.setHours(21, 0, 0, 0);

    // Seed busy list from existing calendar events
    const busy: Slot[] = existingTomorrow
      .filter((e) => e.start && e.end)
      .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));

    const created: typeof proposed = [];
    const skipped: string[]        = [];

    for (const evt of proposed) {
      const proposed_slot: Slot = {
        start: new Date(evt.startTime),
        end:   new Date(evt.endTime),
      };

      const slot = resolveSlot(proposed_slot, busy, workDayEnd);

      if (!slot) {
        skipped.push(evt.title);
        continue;
      }

      await calendar.events.insert({
        calendarId:  'primary',
        requestBody: {
          summary:     evt.title,
          description: evt.description ?? '',
          start: { dateTime: slot.start.toISOString() },
          end:   { dateTime: slot.end.toISOString() },
        },
      });

      // Add the now-committed slot to busy so subsequent events avoid it
      busy.push(slot);
      created.push({ ...evt, startTime: slot.start.toISOString(), endTime: slot.end.toISOString() });
    }

    res.json({ created: created.length, skipped, events: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[plan-tomorrow]', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
