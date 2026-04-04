import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export interface NotionPage {
  id:         string;
  title:      string;
  icon:       string | null;
  lastEdited: string;
  url:        string;
  objectType: 'page' | 'database';
}

export function useNotionPages() {
  const [pages, setPages] = useState<NotionPage[]>([]);

  const fetchPages = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/integrations/notion`);
      if (!res.ok) return;
      const data = await res.json() as { pages: NotionPage[] };
      setPages(data.pages ?? []);
    } catch { /* integration not configured */ }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  return { pages };
}
