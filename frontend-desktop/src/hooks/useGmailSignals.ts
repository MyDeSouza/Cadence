import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export interface GmailSignal {
  id:           string;
  sender:       string;
  senderEmail:  string;
  subject:      string;
  receivedAt:   string;
  snippet:      string;
  threadId:     string;
  score:        number;
  cognitive_type: 'action_bound';
}

export function useGmailSignals() {
  const [signals, setSignals] = useState<GmailSignal[]>([]);

  const fetchSignals = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/integrations/gmail-signals`);
      if (!res.ok) return;
      const data = await res.json() as { signals: GmailSignal[] };
      setSignals(data.signals ?? []);
    } catch { /* integration not configured */ }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  return { signals };
}
