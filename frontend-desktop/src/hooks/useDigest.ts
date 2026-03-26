import { useState, useEffect, useCallback } from 'react';
import type { CadenceEvent } from '../types';
import { API_BASE } from '../constants/api';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SCORE_THRESHOLD = 65;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function useDigest() {
  const [events, setEvents] = useState<CadenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    try {
      // Lower bound = today midnight (excludes stale seed data from previous days).
      // Upper bound = now + 14 days. ?from= is passed for future backend support.
      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cutoff   = new Date(now.getTime() + FOURTEEN_DAYS_MS);

      const res = await fetch(
        `${API_BASE}/events/surfaced?from=${fromDate.toISOString()}`
      );
      if (!res.ok) throw new Error('surfaced fetch failed');
      const all: CadenceEvent[] = await res.json();

      const seen = new Set<string>();

      const filtered = all
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          const ts = new Date(e.timestamp);
          return e.score >= SCORE_THRESHOLD && ts >= fromDate && ts <= cutoff;
        })
        // Chronological order — CalendarWidget and pill both work with this
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setEvents(filtered);
      setError(null);
    } catch {
      setError('unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
    const interval = setInterval(fetchDigest, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDigest]);

  return { events, loading, error, refetch: fetchDigest };
}
