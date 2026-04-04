// ─── Gmail high-priority signal adapter ──────────────────────────────────────
// Surfaces unread important/starred emails as action-bound signals.
// Uses the existing Google OAuth client — no extra credentials needed.

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailSignal {
  id:           string;
  sender:       string;
  senderEmail:  string;
  subject:      string;
  receivedAt:   string; // ISO 8601
  snippet:      string;
  threadId:     string;
}

function decodeHeader(value: string): string {
  return value.trim();
}

function parseFrom(from: string): { name: string; email: string } {
  // Formats: "Name <email@domain.com>" or just "email@domain.com"
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2] };
  return { name: from, email: from };
}

export async function fetchGmailSignals(auth: OAuth2Client): Promise<GmailSignal[]> {
  try {
    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch unread messages that are important OR starred — either qualifies as a signal
    const listRes = await gmail.users.messages.list({
      userId:    'me',
      q:         'is:unread (is:important OR is:starred) -category:promotions -category:social',
      maxResults: 8,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) return [];

    const signals = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.id) return null;
        try {
          const detail = await gmail.users.messages.get({
            userId:          'me',
            id:              msg.id,
            format:          'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = detail.data.payload?.headers ?? [];
          const get = (name: string) =>
            decodeHeader(headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '');

          const from    = parseFrom(get('from'));
          const subject = get('subject') || '(no subject)';
          const date    = get('date');

          // Parse the RFC 2822 date string into ISO
          const receivedAt = date ? new Date(date).toISOString() : new Date().toISOString();

          return {
            id:          msg.id,
            sender:      from.name || from.email,
            senderEmail: from.email,
            subject,
            receivedAt,
            snippet:     detail.data.snippet ?? '',
            threadId:    detail.data.threadId ?? msg.id,
          } satisfies GmailSignal;
        } catch {
          return null;
        }
      }),
    );

    return signals.filter((s): s is GmailSignal => s !== null);
  } catch (err) {
    console.error('[gmail-signals] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
