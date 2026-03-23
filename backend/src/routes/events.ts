import { Router, Request, Response } from 'express';
import prisma from '../db';
import { adaptManualInput } from '../adapters/manual.adapter';
import { scoreEvent } from '../engine/scoring';
import { classifyEvent } from '../engine/classification';
import { getPreferences } from '../lib/preferences';
import { ManualEventInput } from '../types';

const router = Router();

// ─── POST /events — ingest a manual signal ───────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const input = req.body as ManualEventInput;

  if (!input.title || !input.type || !input.timestamp) {
    res.status(400).json({ error: 'title, type, and timestamp are required' });
    return;
  }

  const prefs = await getPreferences();

  // 1. Normalize
  const normalized = adaptManualInput(input);

  // 2. Score
  const score = scoreEvent(normalized, prefs);

  // 3. Fetch existing events for conflict detection
  const existing = await prisma.cadenceEvent.findMany({
    where: { type: 'event' },
    select: { id: true, score: true, type: true, timestamp: true, deadline: true },
  });

  // 4. Classify
  const cognitive_type = classifyEvent(
    { score, type: normalized.type, timestamp: normalized.timestamp, deadline: normalized.deadline },
    existing.map((e) => ({
      id: e.id,
      score: e.score,
      type: e.type as 'event' | 'task' | 'notification' | 'email',
      timestamp: e.timestamp.toISOString(),
      deadline: e.deadline?.toISOString(),
    }))
  );

  // 5. Persist
  const created = await prisma.cadenceEvent.create({
    data: {
      id: normalized.id,
      title: normalized.title,
      source: normalized.source,
      type: normalized.type,
      timestamp: new Date(normalized.timestamp),
      deadline: normalized.deadline ? new Date(normalized.deadline) : undefined,
      raw_content: normalized.raw_content,
      tags: normalized.tags,
      score,
      cognitive_type,
    },
  });

  res.status(201).json(created);
});

// ─── GET /events — all events, sorted by score descending ────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const events = await prisma.cadenceEvent.findMany({
    orderBy: [{ score: 'desc' }, { created_at: 'desc' }],
  });
  res.json(events);
});

// ─── GET /events/surfaced — events above surface_threshold ───────────────────

router.get('/surfaced', async (_req: Request, res: Response): Promise<void> => {
  const prefs = await getPreferences();

  const events = await prisma.cadenceEvent.findMany({
    where: {
      score: { gte: prefs.surface_threshold },
      user_actioned: null,
    },
    orderBy: { score: 'desc' },
  });

  res.json(events);
});

// ─── GET /events/:id — single event ──────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const event = await prisma.cadenceEvent.findUnique({ where: { id: req.params.id as string } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

export default router;
