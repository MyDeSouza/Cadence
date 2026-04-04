import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants/api';

export interface YouTubeVideo {
  videoId:      string;
  title:        string;
  channelName:  string;
  thumbnailUrl: string;
  publishedAt:  string;
  url:          string;
}

export function useYouTubeVideos(context?: string) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);

  const fetchVideos = useCallback(async () => {
    try {
      const params = context ? `?q=${encodeURIComponent(context)}` : '';
      const res    = await fetch(`${API_BASE}/integrations/youtube${params}`);
      if (!res.ok) return;
      const data   = await res.json() as { videos: YouTubeVideo[] };
      setVideos(data.videos ?? []);
    } catch { /* integration not configured */ }
  }, [context]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  return { videos };
}
