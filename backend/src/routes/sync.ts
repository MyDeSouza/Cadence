import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import prisma from '../db';
import { adaptGoogleCalendarEvent } from '../adapters/google-calendar.adapter';
import { scoreEvent } from '../engine/scoring';
import { classifyEvent } from '../engine/classification';
import { getPreferences } from '../lib/preferences';
import { exchangeCodeAndStore, getAuthUrl, getAuthorizedClient } from '../lib/google-auth';

const router = Router();

// ─── GET /sync/google/auth — redirect to Google consent screen ───────────────

router.get('/google/auth', (_req: Request, res: Response): void => {
  res.redirect(getAuthUrl());
});

// ─── GET /sync/google/callback — exchange code, persist tokens ───────────────

router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string | undefined;

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  await exchangeCodeAndStore(code);
  res.json({ status: 'connected', message: 'Google Calendar connected. Use GET /sync/google to sync.' });
});

// ─── GET /sync/google — fetch upcoming events and upsert into Cadence ────────

router.get('/google', async (_req: Request, res: Response): Promise<void> => {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const now         = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      now.toISOString(),
    timeMax:      sevenDaysOut.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   50,
  });

  const gcEvents = response.data.items ?? [];
  const prefs    = await getPreferences();

  // Load existing events once for conflict detection
  const existing = await prisma.cadenceEvent.findMany({
    where:  { type: 'event' },
    select: { id: true, score: true, type: true, timestamp: true, deadline: true },
  });

  const existingForClassify = existing.map((e) => ({
    id:        e.id,
    score:     e.score,
    type:      e.type as 'event' | 'task' | 'notification' | 'email',
    timestamp: e.timestamp.toISOString(),
    deadline:  e.deadline?.toISOString(),
  }));

  const upsertedIds: string[] = [];

  for (const gcEvent of gcEvents) {
    if (!gcEvent.id) continue;

    const normalized     = adaptGoogleCalendarEvent(gcEvent);
    const score          = scoreEvent(normalized, prefs);
    const cognitive_type = classifyEvent(
      { score, type: normalized.type, timestamp: normalized.timestamp, deadline: normalized.deadline },
      existingForClassify
    );

    await prisma.cadenceEvent.upsert({
      where: { id: normalized.id },
      create: {
        id:            normalized.id,
        title:         normalized.title,
        source:        normalized.source,
        type:          normalized.type,
        timestamp:     new Date(normalized.timestamp),
        deadline:      normalized.deadline ? new Date(normalized.deadline) : undefined,
        raw_content:   normalized.raw_content,
        tags:          normalized.tags,
        score,
        cognitive_type,
      },
      update: {
        title:         normalized.title,
        timestamp:     new Date(normalized.timestamp),
        deadline:      normalized.deadline ? new Date(normalized.deadline) : null,
        raw_content:   normalized.raw_content,
        score,
        cognitive_type,
      },
    });

    upsertedIds.push(normalized.id);
  }

  // Record last sync time
  await prisma.source.update({
    where: { user_id_source_type: { user_id: 'default', source_type: 'google_calendar' } },
    data:  { last_synced: new Date() },
  });

  res.json({ synced: upsertedIds.length, event_ids: upsertedIds });
});

export default router;
