import { useState, useEffect } from 'react';
import type { CadenceEvent } from '../types';

function formatMs(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `in ${hours}h ${mins}m`;
  if (hours > 0) return `in ${hours}h`;
  return `in ${mins}m`;
}

export function useCountdown(events: CadenceEvent[]) {
  const [text, setText] = useState('');
  const [nextEvent, setNextEvent] = useState<CadenceEvent | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const upcoming = [...events]
        .filter((e) => new Date(e.timestamp) > now)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      if (upcoming.length === 0) {
        setNextEvent(null);
        setText('Nothing scheduled today');
        return;
      }

      const next = upcoming[0];
      setNextEvent(next);
      const ms = new Date(next.timestamp).getTime() - now.getTime();
      setText(`Next: ${next.title} ${formatMs(ms)}`);
    };

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [events]);

  return { text, nextEvent };
}
