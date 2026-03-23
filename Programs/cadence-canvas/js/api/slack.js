// cadence-canvas / js / api / slack.js
// API_SLOT: Slack Web API
//
// Surfaces the most relevant unread thread for the current context.
// Integration order: 4th
// Note: Slack API requires a bot token — use a serverless proxy.

const SlackAPI = (() => {

  const CONFIG = {
    // API_SLOT — set via serverless proxy (token must NOT be exposed client-side)
    proxyBase: '/api/slack',
    // Channels to monitor for context-relevant threads
    channels: ['design', 'dev', 'general'],
  };

  // ── Get relevant threads ──────────────────────────────────
  async function getRelevantThreads(contextKeywords = [], limit = 3) {
    // API_SLOT ─────────────────────────────────────────────────
    // Fetch unread messages from monitored channels.
    //
    // const channelData = await Promise.all(
    //   CONFIG.channels.map(async channel => {
    //     const res = await fetch(`${CONFIG.proxyBase}/conversations.history`, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({ channel, limit: 5, unread_only: true })
    //     });
    //     return res.json();
    //   })
    // );
    //
    // // Score by relevance to current context keywords
    // const scored = channelData.flatMap((ch, i) =>
    //   (ch.messages || []).map(msg => ({
    //     id:       msg.ts,
    //     channel:  `#${CONFIG.channels[i]}`,
    //     sender:   msg.user,
    //     message:  msg.text,
    //     time:     formatSlackTime(msg.ts),
    //     unread:   true,
    //     score:    scoreRelevance(msg.text, contextKeywords),
    //   }))
    // ).sort((a, b) => b.score - a.score);
    //
    // return scored.slice(0, limit);
    // ──────────────────────────────────────────────────────────

    return MOCK.slack.slice(0, limit);
  }

  // ── Post a reply ──────────────────────────────────────────
  async function postReply(channel, threadTs, text) {
    // API_SLOT ─────────────────────────────────────────────────
    // const res = await fetch(`${CONFIG.proxyBase}/chat.postMessage`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ channel, thread_ts: threadTs, text })
    // });
    // return res.json();
    // ──────────────────────────────────────────────────────────

    console.log('[Cadence] Slack reply queued (API_SLOT):', { channel, text });
    return { ok: true, simulated: true };
  }

  // ── Helpers ───────────────────────────────────────────────
  function formatSlackTime(ts) {
    const d = new Date(parseFloat(ts) * 1000);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function scoreRelevance(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.reduce((score, kw) => score + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
  }

  return { getRelevantThreads, postReply };

})();
