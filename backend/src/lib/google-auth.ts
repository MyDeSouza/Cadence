import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db';

// ─── Google OAuth2 helpers ────────────────────────────────────────────────────

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function createClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/sync/google/callback'
  );
}

// Returns the Google consent-screen URL to redirect the user to.
export function getAuthUrl(): string {
  return createClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh_token on every auth
  });
}

// Exchange an authorization code for tokens and persist them in the Source table.
export async function exchangeCodeAndStore(code: string, userId = 'default'): Promise<void> {
  const client = createClient();
  const { tokens } = await client.getToken(code);

  await prisma.source.upsert({
    where:  { user_id_source_type: { user_id: userId, source_type: 'google_calendar' } },
    create: {
      user_id:       userId,
      source_type:   'google_calendar',
      access_token:  tokens.access_token  ?? null,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry:  tokens.expiry_date   ? new Date(tokens.expiry_date) : null,
      is_active:     true,
    },
    update: {
      access_token:  tokens.access_token  ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      token_expiry:  tokens.expiry_date   ? new Date(tokens.expiry_date) : undefined,
      is_active:     true,
    },
  });
}

// Returns an authorized OAuth2Client, refreshing the access token if it is
// within 5 minutes of expiry. Throws if the integration has not been connected.
export async function getAuthorizedClient(userId = 'default'): Promise<OAuth2Client> {
  const source = await prisma.source.findUnique({
    where: { user_id_source_type: { user_id: userId, source_type: 'google_calendar' } },
  });

  if (!source?.access_token) {
    throw new Error('Google Calendar not connected — visit GET /sync/google/auth first.');
  }

  const client = createClient();
  client.setCredentials({
    access_token:  source.access_token,
    refresh_token: source.refresh_token ?? undefined,
    expiry_date:   source.token_expiry?.getTime(),
  });

  // Proactively refresh if token expires within 5 minutes
  if (source.token_expiry && source.token_expiry.getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    await prisma.source.update({
      where: { user_id_source_type: { user_id: userId, source_type: 'google_calendar' } },
      data: {
        access_token: credentials.access_token  ?? undefined,
        token_expiry: credentials.expiry_date   ? new Date(credentials.expiry_date) : undefined,
      },
    });
    client.setCredentials(credentials);
  }

  return client;
}
