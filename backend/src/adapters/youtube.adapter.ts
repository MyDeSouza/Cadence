// ─── YouTube Data API v3 adapter ─────────────────────────────────────────────
// Requires env: YOUTUBE_API_KEY
// Optional env: YOUTUBE_CHANNEL_IDS  (comma-separated channel IDs)
//   When set: fetches the latest 1 video per channel via search endpoint.
//   When absent: falls back to 4 trending videos in Canada (chart=mostPopular).

export interface YouTubeVideo {
  videoId:      string;
  title:        string;
  channelName:  string;
  thumbnailUrl: string;
  publishedAt:  string; // ISO 8601
  url:          string;
}

// Response shape for videos?chart=mostPopular
interface YouTubeVideosResponse {
  items: Array<{
    id: string;
    snippet: {
      title:        string;
      channelTitle: string;
      publishedAt:  string;
      thumbnails:   { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
}

// Response shape for search?type=video
interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId?: string };
    snippet: {
      title:        string;
      channelTitle: string;
      publishedAt:  string;
      thumbnails:   { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
}

function bestThumb(thumbnails: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }): string {
  return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? '';
}

async function fetchTrending(apiKey: string): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({
    part:       'snippet,contentDetails',
    chart:      'mostPopular',
    maxResults: '4',
    regionCode: 'CA',
    key:        apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) throw new Error(`YouTube trending → ${res.status}`);
  const data = await res.json() as YouTubeVideosResponse;

  return (data.items ?? []).map((item) => ({
    videoId:      item.id,
    title:        item.snippet.title,
    channelName:  item.snippet.channelTitle,
    thumbnailUrl: bestThumb(item.snippet.thumbnails),
    publishedAt:  item.snippet.publishedAt,
    url:          `https://www.youtube.com/watch?v=${item.id}`,
  }));
}

async function fetchLatestFromChannel(channelId: string, apiKey: string): Promise<YouTubeVideo | null> {
  const params = new URLSearchParams({
    part:       'snippet',
    channelId,
    maxResults: '1',
    order:      'date',
    type:       'video',
    key:        apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    console.warn(`[youtube] channel ${channelId} search → ${res.status}`);
    return null;
  }
  const data = await res.json() as YouTubeSearchResponse;
  const item = data.items?.[0];
  if (!item?.id?.videoId) return null;

  return {
    videoId:      item.id.videoId,
    title:        item.snippet.title,
    channelName:  item.snippet.channelTitle,
    thumbnailUrl: bestThumb(item.snippet.thumbnails),
    publishedAt:  item.snippet.publishedAt,
    url:          `https://www.youtube.com/watch?v=${item.id.videoId}`,
  };
}

async function fetchByQuery(query: string, apiKey: string): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({
    part:       'snippet',
    q:          query,
    maxResults: '4',
    type:       'video',
    key:        apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`YouTube query search → ${res.status}`);
  const data = await res.json() as YouTubeSearchResponse;

  return (data.items ?? [])
    .filter((item) => item.id.videoId)
    .map((item) => ({
      videoId:      item.id.videoId!,
      title:        item.snippet.title,
      channelName:  item.snippet.channelTitle,
      thumbnailUrl: bestThumb(item.snippet.thumbnails),
      publishedAt:  item.snippet.publishedAt,
      url:          `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
}

export async function fetchYouTubeVideos(query?: string): Promise<YouTubeVideo[]> {
  const apiKey     = process.env.YOUTUBE_API_KEY;
  const channelEnv = process.env.YOUTUBE_CHANNEL_IDS;

  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set — skipping');
    return [];
  }

  try {
    // User-specified topic query takes priority
    if (query) return await fetchByQuery(query, apiKey);

    if (channelEnv) {
      const channelIds = channelEnv.split(',').map((c) => c.trim()).filter(Boolean);
      const results = await Promise.all(
        channelIds.map((id) => fetchLatestFromChannel(id, apiKey)),
      );
      return results.filter((v): v is YouTubeVideo => v !== null);
    }

    return await fetchTrending(apiKey);
  } catch (err) {
    console.error('[youtube] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
