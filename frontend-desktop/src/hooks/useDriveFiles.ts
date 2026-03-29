import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export type DriveFileType = 'doc' | 'slides' | 'sheet' | 'pdf';

export interface DriveFile {
  title:    string;
  url:      string;
  type:     DriveFileType;
  modified: string;
  eventId?: string;
}

export function useDriveFiles() {
  const [files, setFiles] = useState<DriveFile[]>([]);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sync/drive`);
      if (!res.ok) return;
      const data = await res.json() as { files: DriveFile[] };
      setFiles(data.files ?? []);
    } catch {
      // Drive scope may not be authorized yet — fail silently
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { files };
}
