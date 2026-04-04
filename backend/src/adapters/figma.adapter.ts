// ─── Figma REST API adapter ───────────────────────────────────────────────────
// Requires env: FIGMA_TOKEN, FIGMA_TEAM_ID
// Both are available at figma.com → account settings / team settings.

export interface FigmaFile {
  key:           string;
  name:          string;
  thumbnailUrl:  string | null;
  lastModified:  string; // ISO 8601
  url:           string;
}

const BASE = 'https://api.figma.com/v1';

async function figmaGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) throw new Error(`Figma API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface FigmaProjectsResponse {
  projects: Array<{ id: string; name: string }>;
}

interface FigmaFilesResponse {
  files: Array<{
    key:          string;
    name:         string;
    thumbnail_url: string;
    last_modified: string;
  }>;
}

export async function fetchFigmaFiles(): Promise<FigmaFile[]> {
  const token  = process.env.FIGMA_TOKEN;
  const teamId = process.env.FIGMA_TEAM_ID;

  if (!token || !teamId) {
    console.warn('[figma] FIGMA_TOKEN or FIGMA_TEAM_ID not set — skipping');
    return [];
  }

  try {
    const { projects } = await figmaGet<FigmaProjectsResponse>(
      `/teams/${teamId}/projects`,
      token,
    );

    // Fetch files for every project in parallel, then flatten
    const fileArrays = await Promise.all(
      projects.map((p) =>
        figmaGet<FigmaFilesResponse>(`/projects/${p.id}/files`, token)
          .then((r) => r.files)
          .catch(() => [] as FigmaFilesResponse['files']),
      ),
    );

    const all = fileArrays
      .flat()
      .sort(
        (a, b) =>
          new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime(),
      )
      .slice(0, 3);

    return all.map((f) => ({
      key:          f.key,
      name:         f.name,
      thumbnailUrl: f.thumbnail_url ?? null,
      lastModified: f.last_modified,
      url:          `https://www.figma.com/file/${f.key}`,
    }));
  } catch (err) {
    console.error('[figma] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
