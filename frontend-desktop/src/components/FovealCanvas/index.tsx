import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { ActiveSession, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import type { DriveFile, DriveFileType } from '../../hooks/useDriveFiles';
import { useDriveFiles } from '../../hooks/useDriveFiles';
import { useDigest } from '../../hooks/useDigest';
import { API_BASE } from '../../constants/api';
import styles from './FovealCanvas.module.css';

interface Props {
  session:      ActiveSession | null;
  onEndSession: () => void;
  theme:        Theme;
}

// ── File type SVG icons ────────────────────────────────────
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="4.5" y1="5"   x2="8.5" y2="5"   stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="4.5" y1="7.5" x2="8.5" y2="7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="4.5" y1="10"  x2="7"   y2="10"  stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M9 1v3.5H13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function SlidesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x="5" y="6" width="6"  height="4"  rx="0.75" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="2"   y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1" />
      <line x1="2"   y1="10"  x2="14" y2="10"  stroke="currentColor" strokeWidth="1" />
      <line x1="7.5" y1="2"   x2="7.5" y2="14" stroke="currentColor" strokeWidth="1" />
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

// ── Helpers ────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `Modified ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `Modified ${diffH}h ago`;
  if (diffH < 48)    return 'Modified yesterday';
  return `Modified ${Math.floor(diffH / 24)}d ago`;
}

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

function fmtEventTime(event: CadenceEvent): string {
  const start = parseISO(event.timestamp);
  if (event.deadline) {
    return `${format(start, 'h:mm')} – ${format(parseISO(event.deadline), 'h:mmaaa')}`;
  }
  return format(start, 'h:mmaaa');
}

const CARD_GRADIENTS: Record<DriveFileType, string> = {
  slides: 'linear-gradient(180deg, rgba(255,166,0,0.16) 50.25%, rgba(31,15,0,0.61) 100%)',
  doc:    'linear-gradient(180deg, rgba(7,65,151,0.31) 50.25%, rgba(33,46,64,0.61) 100%)',
  sheet:  'linear-gradient(180deg, rgba(7,65,151,0.31) 50.25%, rgba(33,46,64,0.61) 100%)',
  pdf:    'linear-gradient(180deg, rgba(7,65,151,0.31) 50.25%, rgba(33,46,64,0.61) 100%)',
};

const ARROW_COLORS: Record<DriveFileType, string> = {
  slides: '#f59e0b',
  doc:    '#3b82f6',
  sheet:  '#3b82f6',
  pdf:    '#3b82f6',
};

// ── Drive file card ────────────────────────────────────────
function DriveCard({ file, index }: { file: DriveFile; index: number }) {
  const col  = index % 2;
  const row  = Math.floor(index / 2);
  const top  = 260 + row * (201 + 24);
  const left = 160 + col * (332 + 36);

  const gradient = CARD_GRADIENTS[file.type];

  return (
    <div
      className={styles.card}
      style={{ top, left, animationDelay: `${index * 80}ms` }}
    >
      {/* Background thumbnail */}
      {file.thumbnailLink && (
        <img src={file.thumbnailLink} alt="" className={styles.cardBg} />
      )}
      <div className={styles.cardOverlay} style={{ background: gradient }} />

      {/* Top row: timestamp + type icon */}
      <div className={styles.cardHeader}>
        <div className={styles.cardTimePill}>
          <div className={styles.clockIcon} />
          {relativeTime(file.modified)}
        </div>
        <div className={styles.cardTypeIcon}>
          {FILE_ICONS[file.type]}
        </div>
      </div>

      {/* Bottom row: title + open button */}
      <div className={styles.cardFooter}>
        <div className={styles.cardTitleBlock}>
          <span className={styles.cardTitle}>{file.title}</span>
        </div>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cardOpenBtn}
          onClick={(e) => e.stopPropagation()}
          aria-label="Open file"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13L13 3M13 3H6M13 3V10" stroke={ARROW_COLORS[file.type]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

// ── Event signal card ──────────────────────────────────────
function SignalCard({
  event, index, theme, onDone,
}: {
  event:  CadenceEvent;
  index:  number;
  theme:  Theme;
  onDone: (id: string) => void;
}) {
  const [acting, setActing] = useState(false);

  const handleDone = async () => {
    if (acting) return;
    setActing(true);
    try {
      await fetch(`${API_BASE}/feedback`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cadence_event_id: event.id, outcome: 'actioned' }),
      });
      onDone(event.id);
    } catch {
      setActing(false);
    }
  };

  return (
    <div
      className={`${styles.signal} ${styles[`signal_${theme}`]}`}
      style={{ top: 100 + index * 72, animationDelay: `${index * 60}ms` }}
    >
      <div className={styles.signalBody}>
        <span className={`${styles.signalTitle} ${styles[`signalTitle_${theme}`]}`}>
          {event.title}
        </span>
        <span className={`${styles.signalTime} ${styles[`signalTime_${theme}`]}`}>
          {fmtEventTime(event)}
        </span>
      </div>
      <button
        className={`${styles.doneBtn} ${styles[`doneBtn_${theme}`]}`}
        onClick={handleDone}
        disabled={acting}
        aria-label="Mark as done"
      >
        ✓
      </button>
    </div>
  );
}

// ── FovealCanvas ───────────────────────────────────────────
export function FovealCanvas({ theme }: Props) {
  const { events }          = useDigest();
  const { files: allFiles } = useDriveFiles();

  // Local state so dismissed cards disappear immediately
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  const focusEvent   = getFocusEvent(events);
  // Show files matched to the active event, files matched to any event,
  // and unmatched files ("none") — up to 4 total.
  const matchedFiles = allFiles
    .sort((a, b) => {
      // Prioritise files matched to the current focus event
      const aMatch = focusEvent && a.eventId === focusEvent.id ? 0 : a.eventId && a.eventId !== 'none' ? 1 : 2;
      const bMatch = focusEvent && b.eventId === focusEvent.id ? 0 : b.eventId && b.eventId !== 'none' ? 1 : 2;
      return aMatch - bMatch;
    })
    .slice(0, 4);

  // Show up to 4 upcoming/active surfaced signals (Cowan's limit)
  const now           = new Date();
  const signalEvents  = events
    .filter((e) => {
      if (dismissed.has(e.id)) return false;
      const end = e.deadline ? new Date(e.deadline) : new Date(new Date(e.timestamp).getTime() + 3_600_000);
      return end >= now; // active or upcoming
    })
    .slice(0, 4);

  return (
    <div className={styles.canvas}>
      {/* Drive file cards — top-left area */}
      {matchedFiles.map((file, i) => (
        <DriveCard key={file.url} file={file} index={i} />
      ))}

      {/* Signal cards — right side, stacked vertically */}
      {signalEvents.map((event, i) => (
        <SignalCard
          key={event.id}
          event={event}
          index={i}
          theme={theme}
          onDone={dismiss}
        />
      ))}
    </div>
  );
}
