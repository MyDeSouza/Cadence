import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export type DriveFileType = 'doc' | 'slides' | 'sheet' | 'pdf';

export interface DriveFile {
  id:               string;
  title:            string;
  url:              string;
  type:             DriveFileType;
  modified:         string; // ISO 8601
  createdTime:      string; // ISO 8601
  owner:            string; // email — used for event matching
  ownerName:        string; // display name
  lastModifiedBy:   string; // display name of lastModifyingUser
  size:             number | null; // bytes; null for native Google formats
  thumbnailLink:    string | null;
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
  const drive        = google.drive({ version: 'v3', auth });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const response = await drive.files.list({
    q:       `modifiedTime > '${sevenDaysAgo}' and (${MIME_QUERY}) and trashed = false`,
    fields:  'files(id, name, mimeType, modifiedTime, createdTime, webViewLink, owners, lastModifyingUser, size, quotaBytesUsed, thumbnailLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  const files = response.data.files ?? [];

  return files
    .filter((f) => f.id && f.name && f.mimeType && f.webViewLink)
    .map((f) => {
      // Native Google formats report quotaBytesUsed instead of size
      const rawSize = f.size ?? f.quotaBytesUsed ?? null;
      return {
        id:             f.id!,
        title:          f.name!,
        url:            f.webViewLink!,
        type:           MIME_MAP[f.mimeType!],
        modified:       f.modifiedTime!,
        createdTime:    f.createdTime ?? f.modifiedTime!,
        owner:          f.owners?.[0]?.emailAddress ?? '',
        ownerName:      f.owners?.[0]?.displayName  ?? f.owners?.[0]?.emailAddress ?? '',
        lastModifiedBy: f.lastModifyingUser?.displayName ?? '',
        size:           rawSize != null ? parseInt(rawSize, 10) : null,
        thumbnailLink:  f.thumbnailLink ?? null,
      };
    });
}
