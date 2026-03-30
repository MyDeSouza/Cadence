import { Router, Request, Response } from 'express';
import axios from 'axios';
import { adaptMicrosoftCalendarEvent } from '../adapters/microsoft-calendar.adapter';

// ─── Microsoft Graph sync routes ──────────────────────────────────────────────
// Mirrors the Google sync route pattern.
// Handles OAuth 2.0 flow and calendar event fetching via Microsoft Graph API.

const router = Router();

const MS_CLIENT_ID     = process.env.MICROSOFT_CLIENT_ID!;
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const MS_REDIRECT_URI  = process.env.MICROSOFT_REDIRECT_URI!;
const MS_TENANT_ID     = process.env.MICROSOFT_TENANT_ID!;

// Scopes we need — mirrors what Google adapter covers
const SCOPES = [
  'offline_access',
  'Calendars.Read',
  'Mail.Read',
  'Files.Read',
  'User.Read',
].join(' ');

// ─── Step 1: Redirect user to Microsoft login ─────────────────────────────────
router.get('/auth', (_req: Request, res: Response) => {
  const authUrl =
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize` +
    `?client_id=${MS_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(MS_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&response_mode=query`;

  console.log('[MS auth] Redirecting to Microsoft login');
  res.redirect(authUrl);
});

// ─── Step 2: Handle OAuth callback, exchange code for tokens ─────────────────
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).json({ error: 'No authorization code returned' });
    return;
  }

  try {
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id:     MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        redirect_uri:  MS_REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenRes.data as {
      access_token: string;
      refresh_token: string;
    };

    // TODO: Persist tokens to DB (same pattern as Google tokens)
    console.log('[MS auth] Tokens received — access_token length:', access_token?.length);
    console.log('[MS auth] Refresh token present:', !!refresh_token);

    res.json({
      message: 'Microsoft OAuth successful',
      access_token,
      refresh_token,
    });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? (err.response?.data ?? err.message) : String(err);
    console.error('[MS auth] Token exchange failed:', msg);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ─── Step 3: Fetch and normalize calendar events ──────────────────────────────
router.get('/calendar', async (req: Request, res: Response) => {
  const accessToken = req.headers['x-ms-token'] as string;

  if (!accessToken) {
    res.status(401).json({ error: 'Missing x-ms-token header' });
    return;
  }

  try {
    const graphRes = await axios.get(
      'https://graph.microsoft.com/v1.0/me/events?$top=50&$orderby=start/dateTime',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEvents: any[] = (graphRes.data as { value?: any[] }).value ?? [];
    const normalized = rawEvents.map(adaptMicrosoftCalendarEvent);

    console.log(`[MS calendar] Fetched ${normalized.length} events`);
    res.json({ events: normalized });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? (err.response?.data ?? err.message) : String(err);
    console.error('[MS calendar] Fetch failed:', msg);
    res.status(500).json({ error: 'Failed to fetch Microsoft Calendar events' });
  }
});

export default router;
