// ─── YouTube Data API v3 adapter ─────────────────────────────────────────────
// Requires env: YOUTUBE_API_KEY
// Uses YouTube search to surface contextually relevant videos.
// When a calendar context is provided, results are tailored to the active event.

export interface YouTubeVideo {
  videoId:     string;
  title:       string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string; // ISO 8601
  url:         string;
}

interface YouTubeSearchResponse {
  items: Array<{
    id:      { videoId?: string };
    snippet: {
      title:        string;
      channelTitle: string;
      publishedAt:  string;
      thumbnails:   { medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
}

// Derive search keywords from a calendar event title/context string.
// Strips generic noise words and adds "tutorial" or "guide" for learning intent.
function buildQuery(context: string): string {
  const cleaned = context
    .replace(/\b(meeting|review|call|sync|standup|kickoff|catchup|1:1|1on1)\b/gi, '')
    .trim();
  if (cleaned.length < 4) return 'productivity workflow tutorial';
  return `${cleaned} tutorial guide`;
}

export async function fetchYouTubeVideos(context?: string): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set — skipping');
    return [];
  }

  const query = context ? buildQuery(context) : 'productivity workflow tutorial';

  try {
    const params = new URLSearchParams({
      part:         'snippet',
      q:            query,
      type:         'video',
      maxResults:   '4',
      relevanceLanguage: 'en',
      safeSearch:   'strict',
      key:          apiKey,
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    );

    if (!res.ok) throw new Error(`YouTube API → ${res.status}`);
    const data = await res.json() as YouTubeSearchResponse;

    return (data.items ?? [])
      .filter((item) => item.id.videoId)
      .map((item) => ({
        videoId:     item.id.videoId!,
        title:       item.snippet.title,
        channelName: item.snippet.channelTitle,
        thumbnailUrl:
          item.snippet.thumbnails.medium?.url ??
          item.snippet.thumbnails.default?.url ?? '',
        publishedAt: item.snippet.publishedAt,
        url:         `https://www.youtube.com/watch?v=${item.id.videoId!}`,
      }));
  } catch (err) {
    console.error('[youtube] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
