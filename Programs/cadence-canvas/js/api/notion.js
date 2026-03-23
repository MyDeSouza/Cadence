// cadence-canvas / js / api / notion.js
// API_SLOT: Notion API
//
// Retrieves the most relevant doc for the current calendar event or active task.
// Integration order: 3rd

const NotionAPI = (() => {

  const CONFIG = {
    // API_SLOT — set via serverless proxy (Notion API key must NOT be exposed client-side)
    proxyBase: '/api/notion',
    // API_SLOT — your Notion database or page ID for the active project
    databaseId: 'YOUR_NOTION_DATABASE_ID',
  };

  // ── Get most relevant doc ─────────────────────────────────
  async function getRelevantDoc(contextTitle) {
    // API_SLOT ─────────────────────────────────────────────────
    // Search Notion for a doc matching the current context (e.g. event title).
    //
    // const res = await fetch(`${CONFIG.proxyBase}/search`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ query: contextTitle })
    // });
    // const data = await res.json();
    //
    // const page = data.results?.[0];
    // if (!page) return null;
    //
    // return {
    //   id:          page.id,
    //   title:       page.properties?.title?.title?.[0]?.text?.content ?? 'Untitled',
    //   lastEdited:  formatRelative(page.last_edited_time),
    //   editedBy:    page.last_edited_by?.name ?? '',
    //   excerpt:     await getExcerpt(page.id),
    //   url:         page.url,
    // };
    // ──────────────────────────────────────────────────────────

    return MOCK.notion;
  }

  // ── Get page excerpt (first paragraph) ───────────────────
  async function getExcerpt(pageId) {
    // API_SLOT ─────────────────────────────────────────────────
    // const res = await fetch(`${CONFIG.proxyBase}/blocks/${pageId}`);
    // const data = await res.json();
    // const firstParagraph = data.results?.find(b => b.type === 'paragraph');
    // return firstParagraph?.paragraph?.rich_text?.[0]?.plain_text ?? '';
    // ──────────────────────────────────────────────────────────

    return MOCK.notion.excerpt;
  }

  function formatRelative(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  }

  return { getRelevantDoc, getExcerpt };

})();
