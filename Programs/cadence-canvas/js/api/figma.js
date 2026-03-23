// cadence-canvas / js / api / figma.js
// API_SLOT: Figma REST API (file metadata)
//
// Read-only file embed works without an API key for public files.
// For private files and metadata, a personal access token is required.
// Integration order: 2nd — visual, low-friction

const FigmaAPI = (() => {

  const CONFIG = {
    // API_SLOT — Figma personal access token
    // Generate at: figma.com → Settings → Account → Personal access tokens
    accessToken: 'YOUR_FIGMA_PERSONAL_ACCESS_TOKEN',

    // API_SLOT — your Figma file key (from the file URL)
    // e.g. figma.com/file/ABC123/... → fileKey = 'ABC123'
    fileKey: 'YOUR_FIGMA_FILE_KEY',
  };

  // ── Get file metadata ─────────────────────────────────────
  async function getFileMetadata(fileKey) {
    // API_SLOT ─────────────────────────────────────────────────
    // const url = `https://api.figma.com/v1/files/${fileKey}?depth=1`;
    //
    // const res = await fetch(url, {
    //   headers: { 'X-Figma-Token': CONFIG.accessToken }
    // });
    // const data = await res.json();
    //
    // return {
    //   title:        data.name,
    //   lastModified: formatRelative(data.lastModified),
    //   frameCount:   data.document?.children?.length ?? 0,
    //   thumbnailUrl: data.thumbnailUrl,
    // };
    // ──────────────────────────────────────────────────────────

    return {
      title:        MOCK.figma.title,
      lastModified: MOCK.figma.lastModified,
      frameCount:   MOCK.figma.frameCount,
      thumbnailUrl: null,
    };
  }

  // ── Get embed URL for inline display ─────────────────────
  // No auth needed for public files — just embed the Figma URL.
  function getEmbedUrl(figmaFileUrl) {
    // API_SLOT ─────────────────────────────────────────────────
    // For read-only embed (no API key needed for public files):
    // return `https://www.figma.com/embed?embed_host=cadence&url=${encodeURIComponent(figmaFileUrl)}`;
    //
    // Note: for private files, the viewer must be logged in to Figma.
    // ──────────────────────────────────────────────────────────

    return null; // Replace with real URL when file key is configured
  }

  // ── Get active collaborators ──────────────────────────────
  async function getActiveCollaborators(fileKey) {
    // API_SLOT: Figma doesn't expose real-time collaborator presence via REST.
    // Use Figma's Plugin API or WebSocket for live presence.
    // Alternatively, poll file version endpoint and compare editors.
    //
    // const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/versions`, {
    //   headers: { 'X-Figma-Token': CONFIG.accessToken }
    // });
    // const data = await res.json();
    // const recentEditors = [...new Set(data.versions?.slice(0,5).map(v => v.user?.handle))];
    // return recentEditors;
    // ──────────────────────────────────────────────────────────

    return MOCK.figma.activeCollaborators;
  }

  function formatRelative(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1)  return 'just now';
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  }

  return { getFileMetadata, getEmbedUrl, getActiveCollaborators };

})();
