import { Router, Request, Response } from 'express';
import { fetchFigmaFiles }    from '../adapters/figma.adapter';
import { fetchNotionPages }   from '../adapters/notion.adapter';
import { fetchGmailSignals }  from '../adapters/gmail.adapter';
import { fetchYouTubeVideos } from '../adapters/youtube.adapter';
import { getAuthorizedClient } from '../lib/google-auth';
import { scoreEvent }         from '../engine/scoring';
import { getPreferences }     from '../lib/preferences';

const router = Router();

// ─── GET /integrations/figma ──────────────────────────────────────────────────
// Returns 3 most recently modified Figma files from the team.

router.get('/figma', async (_req: Request, res: Response): Promise<void> => {
  const files = await fetchFigmaFiles();
  res.json({ files });
});

// ─── GET /integrations/notion ─────────────────────────────────────────────────
// Returns recently edited Notion pages and databases.

router.get('/notion', async (_req: Request, res: Response): Promise<void> => {
  const pages = await fetchNotionPages();
  res.json({ pages });
});

// ─── GET /integrations/gmail-signals ─────────────────────────────────────────
// Returns unread important/starred emails scored as action-bound signals.

router.get('/gmail-signals', async (_req: Request, res: Response): Promise<void> => {
  try {
    const auth   = await getAuthorizedClient();
    const prefs  = await getPreferences();
    const emails = await fetchGmailSignals(auth);

    const scored = emails.map((email) => {
      const score = scoreEvent(
        {
          source:      'gmail',
          title:       email.subject,
          raw_content: `From: ${email.sender} <${email.senderEmail}>`,
          tags:        ['email', 'unread', 'important'],
          deadline:    undefined,
        },
        prefs,
      );
      return { ...email, score, cognitive_type: 'action_bound' as const };
    });

    res.json({ signals: scored });
  } catch (err) {
    // Google auth not configured — return empty gracefully
    console.warn('[gmail-signals]', err instanceof Error ? err.message : err);
    res.json({ signals: [] });
  }
});

// ─── GET /integrations/youtube ────────────────────────────────────────────────
// Returns contextually relevant YouTube videos.
// Optional query param: ?q=<active event title or keywords>

router.get('/youtube', async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined;
  const videos = await fetchYouTubeVideos(q);
  res.json({ videos });
});

export default router;
