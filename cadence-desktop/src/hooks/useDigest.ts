import { useState, useEffect, useCallback } from 'react';
import type { CadenceEvent, DigestResponse } from '../types';

const API_BASE = 'http://localhost:3001';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SCORE_THRESHOLD = 65;
const MAX_VISIBLE = 4;

export function useDigest() {
  const [events, setEvents] = useState<CadenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/digest`);
      if (!res.ok) throw new Error('digest fetch failed');
      const data: DigestResponse = await res.json();

      let combined: CadenceEvent[] = data.events ?? [];

      // Fallback: if digest returned nothing, pull from /events/surfaced
      if (combined.length === 0) {
        const fallbackRes = await fetch(`${API_BASE}/events/surfaced`);
        if (fallbackRes.ok) {
          const fallback: CadenceEvent[] = await fallbackRes.json();
          combined = fallback;
        }
      }

      // Deduplicate by id, filter by threshold, sort, slice
      const seen = new Set<string>();
      const filtered = combined
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return e.score >= SCORE_THRESHOLD;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_VISIBLE);

      setEvents(filtered);
      setError(null);
    } catch {
      // Graceful silent failure — show empty state
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
