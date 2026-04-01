import { Router, Request, Response } from 'express';

const router = Router();

interface SearchResult {
  title:   string;
  link:    string;
  snippet: string;
}

// ─── GET /search?q= — Google Custom Search ────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q) {
    res.status(400).json({ error: 'Missing required query parameter: q' });
    return;
  }

  const apiKey  = process.env.GOOGLE_SEARCH_API_KEY;
  const cx      = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    res.status(500).json({ error: 'Search API not configured' });
    return;
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', q);
  url.searchParams.set('num', '8');

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const body = await response.text();
      console.error('[search] Google API error', response.status, body);
      res.status(502).json({ error: 'Search API request failed', status: response.status });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data  = await response.json() as any;
    const items = (data.items ?? []) as Array<{ title: string; link: string; snippet: string }>;

    const results: SearchResult[] = items.map((item) => ({
      title:   item.title   ?? '',
      link:    item.link    ?? '',
      snippet: item.snippet ?? '',
    }));

    res.json({ results });
  } catch (err) {
    console.error('[search] fetch threw:', err);
    res.status(502).json({ error: 'Failed to reach search API' });
  }
});

export default router;
