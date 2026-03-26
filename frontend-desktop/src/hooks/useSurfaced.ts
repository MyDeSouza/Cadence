import { useState, useEffect } from 'react';
import { API_BASE } from '../constants/api';

export function useSurfaced() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE}/events/surfaced`);
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? (data.events?.length ?? 0));
      } catch {
        // silent
      }
    };

    fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
