import { Router, Request, Response } from 'express';
import prisma from '../db';
import { getPreferences } from '../lib/preferences';
import { scoreEvent } from '../engine/scoring';
import { classifyEvent } from '../engine/classification';
import { UserPreferences, EventSource } from '../types';

const router = Router();

// ─── GET /preferences ─────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const prefs = await getPreferences();
  res.json(prefs);
});

// ─── PUT /preferences — update config + re-score all pending events ───────────

router.put('/', async (req: Request, res: Response): Promise<void> => {
  const {
    source_weights,
    keyword_boosts,
    tag_weights,
    surface_threshold,
    quiet_hours_start,
    quiet_hours_end,
    digest_time,
    max_foreground_signals,
  } = req.body;

  const updated = await prisma.userPreferences.upsert({
    where: { user_id: 'default' },
    create: { user_id: 'default', ...req.body },
    update: {
      ...(source_weights && { source_weights }),
      ...(keyword_boosts && { keyword_boosts }),
      ...(tag_weights && { tag_weights }),
      ...(surface_threshold !== undefined && { surface_threshold }),
      ...(quiet_hours_start && { quiet_hours_start }),
      ...(quiet_hours_end && { quiet_hours_end }),
      ...(digest_time && { digest_time }),
      ...(max_foreground_signals !== undefined && { max_foreground_signals }),
    },
  });

  // Re-score all pending (unactioned) events with new prefs
  const newPrefs: UserPreferences = {
    id: updated.id,
    user_id: updated.user_id,
    source_weights: updated.source_weights as UserPreferences['source_weights'],
    keyword_boosts: updated.keyword_boosts,
    tag_weights: updated.tag_weights as Record<string, number>,
    surface_threshold: updated.surface_threshold,
    quiet_hours_start: updated.quiet_hours_start,
    quiet_hours_end: updated.quiet_hours_end,
    digest_time: updated.digest_time,
    max_foreground_signals: updated.max_foreground_signals,
  };

  const pendingEvents = await prisma.cadenceEvent.findMany({
    where: { user_actioned: null },
  });

  const rescoreUpdates = pendingEvents.map((e) => {
    const score = scoreEvent(
      {
        source: e.source as EventSource,
        title: e.title,
        raw_content: e.raw_content ?? undefined,
        tags: e.tags,
        deadline: e.deadline?.toISOString(),
      },
      newPrefs
    );

    const cognitive_type = classifyEvent(
      {
        score,
        type: e.type as 'event' | 'task' | 'notification' | 'email',
        timestamp: e.timestamp.toISOString(),
        deadline: e.deadline?.toISOString(),
      },
      pendingEvents.map((pe) => ({
        id: pe.id,
        score: pe.score,
        type: pe.type as 'event' | 'task' | 'notification' | 'email',
        timestamp: pe.timestamp.toISOString(),
        deadline: pe.deadline?.toISOString(),
      }))
    );

    return prisma.cadenceEvent.update({
      where: { id: e.id },
      data: { score, cognitive_type },
    });
  });

  await prisma.$transaction(rescoreUpdates);

  res.json({ preferences: newPrefs, rescored: pendingEvents.length });
});

export default router;
