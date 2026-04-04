import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export interface FigmaFile {
  key:          string;
  name:         string;
  thumbnailUrl: string | null;
  lastModified: string;
  url:          string;
}

export function useFigmaFiles() {
  const [files, setFiles] = useState<FigmaFile[]>([]);

  const fetchFiles = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/integrations/figma`);
      if (!res.ok) return;
      const data = await res.json() as { files: FigmaFile[] };
      setFiles(data.files ?? []);
    } catch { /* integration not configured */ }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  return { files };
}
