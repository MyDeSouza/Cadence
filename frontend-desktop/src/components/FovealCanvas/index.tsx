import type { ActiveSession, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import type { DriveFile, DriveFileType } from '../../hooks/useDriveFiles';
import { useDriveFiles } from '../../hooks/useDriveFiles';
import { useDigest } from '../../hooks/useDigest';
import styles from './FovealCanvas.module.css';

interface Props {
  session:      ActiveSession | null;
  onEndSession: () => void;
  theme:        Theme;
}

// ── SVG icons ──────────────────────────────────────────────
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="4.5" y1="5"  x2="8.5" y2="5"  stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="4.5" y1="7.5" x2="8.5" y2="7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="4.5" y1="10" x2="7"   y2="10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M9 1v3.5H13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function SlidesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x="5" y="6" width="6" height="4"  rx="0.75" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="2"  y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1" />
      <line x1="2"  y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1" />
      <line x1="7.5" y1="2"  x2="7.5" y2="14" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <text x="4" y="10.5" fontFamily="sans-serif" fontSize="5" fontWeight="700" fill="currentColor">PDF</text>
    </svg>
  );
}

const FILE_ICONS: Record<DriveFileType, React.ReactNode> = {
  doc:    <DocIcon />,
  slides: <SlidesIcon />,
  sheet:  <SheetIcon />,
  pdf:    <PdfIcon />,
};

// ── Relative time ──────────────────────────────────────────
function relativeTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)   return `Modified ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)     return `Modified ${diffH}h ago`;
  if (diffH < 48)     return 'Modified yesterday';
  return `Modified ${Math.floor(diffH / 24)}d ago`;
}

// ── Active / next event helper ─────────────────────────────
function getFocusEvent(events: CadenceEvent[]): CadenceEvent | null {
  const now = new Date();
  const active = events.find((e) => {
    const start = new Date(e.timestamp);
    const end   = e.deadline ? new Date(e.deadline) : new Date(start.getTime() + 3_600_000);
    return start <= now && now <= end;
  });
  if (active) return active;
  return events.find((e) => new Date(e.timestamp) > now) ?? null;
}

// ── Single document card ───────────────────────────────────
function DriveCard({
  file, index, theme,
}: {
  file:  DriveFile;
  index: number;
  theme: Theme;
}) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  const top  = 100 + row * 90;
  const left = 40 + col * 240;

  return (
    <div
      className={`${styles.card} ${styles[`card_${theme}`]}`}
      style={{
        top,
        left,
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div className={styles.cardHeader}>
        <span className={`${styles.cardIcon} ${styles[`cardIcon_${theme}`]}`}>
          {FILE_ICONS[file.type]}
        </span>
        <span className={`${styles.cardTitle} ${styles[`cardTitle_${theme}`]}`}>
          {file.title}
        </span>
      </div>
      <div className={styles.cardMeta}>
        <span className={`${styles.cardModified} ${styles[`cardModified_${theme}`]}`}>
          {relativeTime(file.modified)}
        </span>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.cardOpen} ${styles[`cardOpen_${theme}`]}`}
          onClick={(e) => e.stopPropagation()}
        >
          → Open
        </a>
      </div>
    </div>
  );
}

// ── FovealCanvas ───────────────────────────────────────────
export function FovealCanvas({ theme }: Props) {
  const { events }       = useDigest();
  const { files: allFiles } = useDriveFiles();

  const focusEvent   = getFocusEvent(events);
  const matchedFiles = focusEvent
    ? allFiles.filter((f) => f.eventId === focusEvent.id)
    : [];

  return (
    <div className={styles.canvas}>
      {matchedFiles.map((file, i) => (
        <DriveCard key={file.url} file={file} index={i} theme={theme} />
      ))}
    </div>
  );
}
