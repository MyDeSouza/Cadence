import { useState, useCallback } from 'react';
import type { CadenceEvent, ActiveSession } from '../types';

export function useSession() {
  const [session, setSession] = useState<ActiveSession | null>(null);

  const beginSession = useCallback((event: CadenceEvent) => {
    setSession({ event, startedAt: new Date() });
  }, []);

  const endSession = useCallback(() => {
    setSession(null);
  }, []);

  return { session, beginSession, endSession };
}
