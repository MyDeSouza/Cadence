import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export type DriveFileType = 'doc' | 'slides' | 'sheet' | 'pdf';

export interface DriveFile {
  title:          string;
  url:            string;
  type:           DriveFileType;
  modified:       string;
  createdTime:    string;
  ownerName:      string;
  lastModifiedBy: string;
  size:           number | null;
  thumbnailLink:  string | null;
  eventId?:       string;
}

export function useDriveFiles() {
  const [files, setFiles] = useState<DriveFile[]>([]);

  const fetchFiles = useCallback(async () => {
    console.log('[useDriveFiles] fetching from', `${API_BASE}/sync/drive`);
    try {
      const res = await fetch(`${API_BASE}/sync/drive`);

      if (!res.ok) {
        console.warn('[useDriveFiles] fetch failed — status', res.status);
        return;
      }

      const data      = await res.json() as { files: DriveFile[] };
      const incoming  = data.files ?? [];

      console.log(
        `[useDriveFiles] received ${incoming.length} file(s)`,
        incoming.map((f) => ({ title: f.title, type: f.type, eventId: f.eventId ?? 'none' }))
      );

      setFiles(incoming);
    } catch (err) {
      console.warn('[useDriveFiles] fetch threw:', err);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return { files, refetch: fetchFiles };
}
