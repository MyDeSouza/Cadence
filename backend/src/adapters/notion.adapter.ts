// ─── Notion API adapter ───────────────────────────────────────────────────────
// Requires env: NOTION_TOKEN  (internal integration token from notion.so/my-integrations)

export interface NotionPage {
  id:           string;
  title:        string;
  icon:         string | null; // emoji or null
  lastEdited:   string;         // ISO 8601
  url:          string;
  objectType:   'page' | 'database';
}

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Extract a human-readable title from the opaque Notion property bag
function extractTitle(result: NotionSearchResult): string {
  // Pages have a 'title' property; databases have a 'title' array at top level
  if (result.object === 'database') {
    return (result as { title?: Array<{ plain_text?: string }> })
      .title?.map((t) => t.plain_text ?? '').join('') || 'Untitled';
  }

  const props = (result as { properties?: Record<string, NotionPropertyValue> }).properties ?? {};
  // title property can have any key name — find by type
  const titleProp = Object.values(props).find((p) => p.type === 'title');
  if (titleProp?.title) {
    return titleProp.title.map((t) => t.plain_text ?? '').join('') || 'Untitled';
  }
  return 'Untitled';
}

function extractIcon(result: NotionSearchResult): string | null {
  const icon = (result as { icon?: { type: string; emoji?: string } }).icon;
  if (!icon) return null;
  if (icon.type === 'emoji') return icon.emoji ?? null;
  return null;
}

interface NotionPropertyValue {
  type: string;
  title?: Array<{ plain_text?: string }>;
}

interface NotionSearchResult {
  id:               string;
  object:           'page' | 'database';
  url:              string;
  last_edited_time: string;
  // rest is untyped — accessed dynamically
}

interface NotionSearchResponse {
  results: NotionSearchResult[];
}

export async function fetchNotionPages(): Promise<NotionPage[]> {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn('[notion] NOTION_TOKEN not set — skipping');
    return [];
  }

  try {
    const res = await fetch(`${NOTION_API}/search`, {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        sort:      { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 6,
      }),
    });

    if (!res.ok) throw new Error(`Notion search → ${res.status}`);
    const data = await res.json() as NotionSearchResponse;

    return data.results.map((r) => ({
      id:         r.id,
      title:      extractTitle(r),
      icon:       extractIcon(r),
      lastEdited: r.last_edited_time,
      url:        r.url,
      objectType: r.object,
    }));
  } catch (err) {
    console.error('[notion] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
