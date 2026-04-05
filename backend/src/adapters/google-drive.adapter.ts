import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export type DriveFileType = "doc" | "slides" | "sheet" | "pdf";

export interface DriveFile {
  id: string;
  title: string;
  url: string;
  type: DriveFileType;
  modified: string; // ISO 8601
  createdTime: string; // ISO 8601
  owner: string; // email — used for event matching
  ownerName: string; // display name
  lastModifiedBy: string; // display name of lastModifyingUser
  size: number | null; // bytes; null for native Google formats
  thumbnailLink: string | null;
  folderName: string | null; // display name of the immediate parent folder
}

const MIME_MAP: Record<string, DriveFileType> = {
  "application/vnd.google-apps.document": "doc",
  "application/vnd.google-apps.presentation": "slides",
  "application/vnd.google-apps.spreadsheet": "sheet",
  "application/pdf": "pdf",
};

const MIME_QUERY = Object.keys(MIME_MAP)
  .map((m) => `mimeType='${m}'`)
  .join(" or ");

/** Replace the size token in a Drive thumbnailLink with a higher-res value.
 *  Drive URLs end with a size param like =s220 or =s400. Replacing it with
 *  =s1600 returns a much larger preview image from the same CDN URL. */
function upgradeThumbnail(url: string): string {
  // Replace an existing =sNNN param (with optional trailing chars like =s220-c)
  if (/=s\d+/.test(url)) return url.replace(/=s\d+[^&]*/, "=s1600");
  // If no size param present, append one
  return `${url}=s1600`;
}

export async function fetchRecentDriveFiles(
  auth: OAuth2Client,
): Promise<DriveFile[]> {
  try {
    // Force token refresh if the current access token is expired
    await auth.getAccessToken();

    const drive = google.drive({ version: "v3", auth });

    const response = await drive.files.list({
      q: `(${MIME_QUERY}) and trashed = false`,
      fields:
        "files(id, name, mimeType, modifiedTime, createdTime, webViewLink, owners, lastModifyingUser, size, quotaBytesUsed, thumbnailLink, parents)",
      orderBy: "modifiedTime desc",
      pageSize: 20,
    });

    const rawFiles = response.data.files ?? [];

    // Resolve unique parent folder IDs → display names in parallel
    const parentIds = [...new Set(rawFiles.flatMap((f) => f.parents ?? []))];
    const folderEntries = await Promise.all(
      parentIds.map(async (id) => {
        try {
          const folder = await drive.files.get({ fileId: id, fields: "id,name" });
          return [id, folder.data.name ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    );
    const folderMap = new Map(folderEntries);

    return rawFiles
      .filter((f) => {
        if (!f.id || !f.name || !f.mimeType || !f.webViewLink) return false;
        const lower = f.name.toLowerCase();
        if (lower.includes('test') || lower.includes('untitled')) return false;
        return true;
      })
      .slice(0, 8)
      .map((f) => {
        // Native Google formats report quotaBytesUsed instead of size
        const rawSize = f.size ?? f.quotaBytesUsed ?? null;
        return {
          id: f.id!,
          title: f.name!,
          url: f.webViewLink!,
          type: MIME_MAP[f.mimeType!],
          modified: f.modifiedTime!,
          createdTime: f.createdTime ?? f.modifiedTime!,
          owner: f.owners?.[0]?.emailAddress ?? "",
          ownerName:
            f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? "",
          lastModifiedBy: f.lastModifyingUser?.displayName ?? "",
          size: rawSize != null ? parseInt(rawSize, 10) : null,
          thumbnailLink: f.thumbnailLink
            ? upgradeThumbnail(f.thumbnailLink)
            : null,
          folderName: f.parents?.[0] ? (folderMap.get(f.parents[0]) ?? null) : null,
        };
      });
  } catch (err) {
    console.error("[Drive sync] fetchRecentDriveFiles failed:", (err as Error).message);
    return [];
  }
}
