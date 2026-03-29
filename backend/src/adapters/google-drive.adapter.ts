import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export type DriveFileType = 'doc' | 'slides' | 'sheet' | 'pdf';

export interface DriveFile {
  id:       string;
  title:    string;
  url:      string;
  type:     DriveFileType;
  modified: string; // ISO 8601
  owner:    string; // email
}

const MIME_MAP: Record<string, DriveFileType> = {
  'application/vnd.google-apps.document':     'doc',
  'application/vnd.google-apps.presentation': 'slides',
  'application/vnd.google-apps.spreadsheet':  'sheet',
  'application/pdf':                           'pdf',
};

const MIME_QUERY = Object.keys(MIME_MAP)
  .map((m) => `mimeType='${m}'`)
  .join(' or ');

export async function fetchRecentDriveFiles(auth: OAuth2Client): Promise<DriveFile[]> {
  const drive   = google.drive({ version: 'v3', auth });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const response = await drive.files.list({
    q:        `modifiedTime > '${sevenDaysAgo}' and (${MIME_QUERY}) and trashed = false`,
    fields:   'files(id, name, mimeType, modifiedTime, webViewLink, owners)',
    orderBy:  'modifiedTime desc',
    pageSize: 50,
  });

  const files = response.data.files ?? [];

  return files
    .filter((f) => f.id && f.name && f.mimeType && f.webViewLink)
    .map((f) => ({
      id:       f.id!,
      title:    f.name!,
      url:      f.webViewLink!,
      type:     MIME_MAP[f.mimeType!],
      modified: f.modifiedTime!,
      owner:    f.owners?.[0]?.emailAddress ?? '',
    }));
}
