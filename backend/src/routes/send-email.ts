import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { getAuthorizedClient } from '../lib/google-auth';

const router = Router();

// ─── POST /send-email ─────────────────────────────────────────────────────────
// Body: { to: string, subject: string, body: string }
// Sends from the authenticated Gmail account via the Gmail API.

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { to, subject, body } = req.body as {
    to?: string;
    subject?: string;
    body?: string;
  };

  console.log('[send-email] hit — to:', to, '| subject:', subject);

  if (!to || !subject || !body) {
    res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    return;
  }

  try {
    const auth   = await getAuthorizedClient();
    const gmail  = google.gmail({ version: 'v1', auth });

    // Build RFC 2822 message
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n');

    // Gmail API requires base64url encoding (no padding +/= chars)
    const encoded = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-email]', message);
    res.status(500).json({ error: `Failed to send email: ${message}` });
  }
});

export default router;
