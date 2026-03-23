import prisma from '../db';
import { UserPreferences, SourceWeights } from '../types';

// ─── Fetch preferences, creating defaults if first run ───────────────────────

export async function getPreferences(userId = 'default'): Promise<UserPreferences> {
  let row = await prisma.userPreferences.findUnique({ where: { user_id: userId } });

  if (!row) {
    row = await prisma.userPreferences.create({
      data: { user_id: userId },
    });
  }

  return {
    id: row.id,
    user_id: row.user_id,
    source_weights: row.source_weights as SourceWeights,
    keyword_boosts: row.keyword_boosts,
    tag_weights: row.tag_weights as Record<string, number>,
    surface_threshold: row.surface_threshold,
    quiet_hours_start: row.quiet_hours_start,
    quiet_hours_end: row.quiet_hours_end,
    digest_time: row.digest_time,
    max_foreground_signals: row.max_foreground_signals,
  };
}
