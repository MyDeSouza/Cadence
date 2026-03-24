import { useState, useEffect, useCallback } from 'react';
import type { CadenceEvent } from '../types';
import { API_BASE } from '../constants/api';

const MAX_SIGNALS = 4;
const SCORE_THRESHOLD = 65;

export function useSignals() {
  const [signals, setSignals] = useState<CadenceEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CadenceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    try {
      // Trigger a background sync — don't await, fire and forget
      fetch(`${API_BASE}/sync/google`).catch(() => {});

      const res = await fetch(`${API_BASE}/digest`);
      const data = await res.json();
      let events: CadenceEvent[] = data.events ?? [];

      // Fallback to /events/surfaced if digest returns nothing
      if (events.length === 0) {
        const fallbackRes = await fetch(`${API_BASE}/events/surfaced`);
        const fallbackData = await fallbackRes.json();
        events = fallbackData.events ?? [];
      }

      setAllEvents(events);
      setSignals(
        events
          .filter((e) => e.score >= SCORE_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_SIGNALS)
      );
    } catch (err) {
      console.error('[useSignals] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 5 * 60_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  return { signals, allEvents, loading, refresh: fetchSignals };
}
