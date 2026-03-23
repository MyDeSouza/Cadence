import { Router, Request, Response } from 'express';
import prisma from '../db';
import { getPreferences } from '../lib/preferences';

const router = Router();

// ─── GET /digest — top N scored events within a rolling 48-hour window ────────
// Uses a rolling window (12h ago → 36h from now) instead of UTC midnight
// boundaries, making the digest timezone-safe without a tz parameter.

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const prefs = await getPreferences();

  const now = new Date();
  const windowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const events = await prisma.cadenceEvent.findMany({
    where: {
      score: { gte: prefs.surface_threshold },
      user_actioned: null,
      timestamp: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { score: 'desc' },
    take: prefs.max_foreground_signals,
  });

  res.json({
    date: now.toISOString().slice(0, 10),
    events,
    total_surfaced: events.length,
  });
});

export default router;
