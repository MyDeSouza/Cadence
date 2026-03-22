import { Router, Request, Response } from 'express';
import prisma from '../db';
import { getPreferences } from '../lib/preferences';
import { CognitiveType } from '../types';

const router = Router();

// ─── GET /digest — top N scored events, grouped by cognitive_type ─────────────
// This is the primary output the mobile and desktop interfaces consume.

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const prefs = await getPreferences();

  const events = await prisma.cadenceEvent.findMany({
    where: {
      score: { gte: prefs.surface_threshold },
      user_actioned: null,
    },
    orderBy: { score: 'desc' },
    take: prefs.max_foreground_signals,
  });

  // Group by cognitive_type
  const grouped: Record<CognitiveType, typeof events> = {
    conflict: [],
    authorizational: [],
    action_bound: [],
    informational: [],
  };

  for (const event of events) {
    const type = (event.cognitive_type as CognitiveType) ?? 'informational';
    grouped[type].push(event);
  }

  res.json({
    total: events.length,
    max_foreground_signals: prefs.max_foreground_signals,
    surface_threshold: prefs.surface_threshold,
    digest_time: prefs.digest_time,
    signals: grouped,
  });
});

export default router;
