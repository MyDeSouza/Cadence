import { Router, Request, Response } from 'express';
import prisma from '../db';
import { getPreferences } from '../lib/preferences';

const router = Router();

// ─── GET /digest — top N scored events within a rolling 48-hour window ────────
// Uses a rolling window (12h ago → 36h from now) instead of UTC midnight
// boundaries, making the digest timezone-safe without a tz parameter.

// Time-decay factors by days ahead from now
function decayFactor(eventDate: Date, now: Date): number {
  const daysAhead = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAhead <= 1)  return 1.0;
  if (daysAhead <= 7)  return 0.85;
  if (daysAhead <= 14) return 0.7;
  return 0.55;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const prefs = await getPreferences();

  const now         = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd   = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  // Fetch all events in the 3-week window that meet the raw score threshold
  const raw = await prisma.cadenceEvent.findMany({
    where: {
      score: { gte: prefs.surface_threshold },
      user_actioned: null,
      OR: [
        { timestamp: { gte: startOfToday, lte: windowEnd } },
        { deadline:  { gte: startOfToday } },
      ],
    },
    orderBy: { score: 'desc' },
    // Fetch generously — we re-sort and slice in memory after applying decay
    take: prefs.max_foreground_signals * 10,
  });

  // Apply decay and re-rank
  const events = raw
    .map((e) => ({ event: e, decayed: (e.score ?? 0) * decayFactor(e.timestamp, now) }))
    .sort((a, b) => b.decayed - a.decayed)
    .slice(0, prefs.max_foreground_signals)
    .map((r) => r.event);

  res.json({
    date: now.toISOString().slice(0, 10),
    events,
    total_surfaced: events.length,
  });
});

export default router;
