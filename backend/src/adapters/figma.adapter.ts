// ─── Figma REST API adapter ───────────────────────────────────────────────────
// Requires env: FIGMA_TOKEN  (personal access token — figma.com → account settings)
// Optional env: FIGMA_FILE_KEYS  (comma-separated file keys to surface, e.g.
//   "F4u1HZbmsZDDvo4AlA70Pw,oeZ8Kql8WT8bMNLWIOVmx9")
//   Each key is the alphanumeric ID in the Figma file URL.
//   Works for both design files and Slides files — no team ID needed.

export interface FigmaFile {
  key:          string;
  name:         string;
  thumbnailUrl: string | null;
  lastModified: string; // ISO 8601
  fileType:     string; // "design" | "slides" | etc.
  url:          string;
}

const BASE = 'https://api.figma.com/v1';

async function figmaGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) throw new Error(`Figma API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface FigmaFileResponse {
  name:          string;
  lastModified:  string;
  thumbnailUrl:  string;
  // file_type present on some responses; absent means design
  file_type?:    string;
  // Figma also returns these snake_case variants
  last_modified?: string;
  thumbnail_url?: string;
}

function figmaUrl(key: string, fileType: string): string {
  return fileType === 'slides'
    ? `https://www.figma.com/slides/${key}`
    : `https://www.figma.com/design/${key}`;
}

export async function fetchFigmaFiles(): Promise<FigmaFile[]> {
  const token    = process.env.FIGMA_TOKEN;
  const keysEnv  = process.env.FIGMA_FILE_KEYS;

  if (!token) {
    console.warn('[figma] FIGMA_TOKEN not set — skipping');
    return [];
  }

  if (!keysEnv) {
    console.warn('[figma] FIGMA_FILE_KEYS not set — skipping');
    return [];
  }

  const keys = keysEnv.split(',').map((k) => k.trim()).filter(Boolean);

  try {
    const results = await Promise.all(
      keys.map(async (key): Promise<FigmaFile | null> => {
        try {
          const data = await figmaGet<FigmaFileResponse>(`/files/${key}`, token);

          // The /v1/files/:key response uses camelCase at top level
          const name         = data.name;
          const lastModified = data.lastModified ?? data.last_modified ?? '';
          const thumbnailUrl = data.thumbnailUrl ?? data.thumbnail_url ?? null;
          const fileType     = data.file_type ?? 'design';

          console.log(`[figma] fetched "${name}" (type: ${fileType})`);
          return { key, name, thumbnailUrl, lastModified, fileType, url: figmaUrl(key, fileType) };
        } catch (err) {
          console.warn(`[figma] skipping key ${key}:`, err instanceof Error ? err.message : err);
          return null;
        }
      }),
    );

    return (results.filter(Boolean) as FigmaFile[])
      .sort(
        (a, b) =>
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
      )
      .slice(0, 4);
  } catch (err) {
    console.error('[figma] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
