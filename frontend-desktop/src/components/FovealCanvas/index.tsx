import { useState, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { ActiveSession, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import type { DriveFile, DriveFileType } from '../../hooks/useDriveFiles';
import { useDriveFiles }    from '../../hooks/useDriveFiles';
import { useFigmaFiles }    from '../../hooks/useFigmaFiles';
import { useNotionPages }   from '../../hooks/useNotionPages';
import { useGmailSignals }  from '../../hooks/useGmailSignals';
import { useYouTubeVideos } from '../../hooks/useYouTubeVideos';
import { useDigest }        from '../../hooks/useDigest';
import type { FigmaFile }   from '../../hooks/useFigmaFiles';
import type { NotionPage }  from '../../hooks/useNotionPages';
import type { GmailSignal } from '../../hooks/useGmailSignals';
import type { YouTubeVideo } from '../../hooks/useYouTubeVideos';
import { API_BASE } from '../../constants/api';
import styles from './FovealCanvas.module.css';

interface Props {
  session:      ActiveSession | null;
  onEndSession: () => void;
  theme:        Theme;
}

// ── Persistent card positions ──────────────────────────────
const LS_KEY = 'cadence:card-positions';
type Pos = { x: number; y: number };

function loadPositions(): Record<string, Pos> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); }
  catch { return {}; }
}

// ── DraggableCard wrapper ──────────────────────────────────
// Renders the outer .card div. Grid cards detach on 5px drag threshold;
// detached cards are absolutely positioned and immediately draggable.
function DraggableCard({
  id, isDetached, pos, index, extraClass, onDetach, onDrop, children,
}: {
  id:         string;
  isDetached: boolean;
  pos?:       Pos;
  index:      number;
  extraClass?: string;
  onDetach:   (id: string, pos: Pos) => void;
  onDrop:     (id: string, pos: Pos) => void;
  children:   React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) return;
    e.stopPropagation();

    const startMX = e.clientX;
    const startMY = e.clientY;
    let active = isDetached;
    let baseX  = pos?.x ?? 0;
    let baseY  = pos?.y ?? 0;

    if (active) {
      document.body.style.cursor     = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMX;
      const dy = ev.clientY - startMY;

      if (!active) {
        if (Math.hypot(dx, dy) <= 5) return;
        // Threshold crossed — detach from grid
        active = true;
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) { baseX = rect.left; baseY = rect.top; }
        onDetach(id, { x: baseX + dx, y: baseY + dy });
        document.body.style.cursor     = 'grabbing';
        document.body.style.userSelect = 'none';
        return; // next move will do DOM update
      }

      // Direct DOM update for smooth 60fps dragging
      if (cardRef.current) {
        cardRef.current.style.left = `${baseX + dx}px`;
        cardRef.current.style.top  = `${baseY + dy}px`;
      }
    };

    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startMX;
      const dy = ev.clientY - startMY;
      if (active) onDrop(id, { x: baseX + dx, y: baseY + dy });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDetached, pos?.x, pos?.y, onDetach, onDrop]);

  const cls = [styles.card, isDetached ? styles.cardDetached : '', extraClass ?? '']
    .filter(Boolean).join(' ');

  const style: React.CSSProperties = isDetached && pos
    ? { position: 'absolute', left: pos.x, top: pos.y, animationDelay: `${index * 80}ms` }
    : { animationDelay: `${index * 80}ms` };

  return (
    <div ref={cardRef} className={cls} style={style} onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
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
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  if (diffH < 48)    return 'Yesterday';
  return `${Math.floor(diffH / 24)}d ago`;
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

const NEUTRAL_OVERLAY = 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)';

const CARD_GRADIENTS: Record<DriveFileType, string> = {
  slides: NEUTRAL_OVERLAY,
  doc:    NEUTRAL_OVERLAY,
  sheet:  NEUTRAL_OVERLAY,
  pdf:    NEUTRAL_OVERLAY,
};

const ARROW_COLORS: Record<DriveFileType, string> = {
  slides: '#f59e0b',
  doc:    '#3b82f6',
  sheet:  '#3b82f6',
  pdf:    '#3b82f6',
};

// ── Arrow SVG ──────────────────────────────────────────────
function ArrowIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 13L13 3M13 3H6M13 3V10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Card inner content components (no outer div) ───────────
function DriveCardInner({ file }: { file: DriveFile }) {
  return (
    <div className={styles.cardImgWrap}>
      {file.thumbnailLink && <img src={file.thumbnailLink} alt="" className={styles.cardBg} />}
      <div className={styles.cardOverlay} style={{ background: CARD_GRADIENTS[file.type] }} />
      <div className={styles.cardHeader}>
        <div className={styles.cardTimePill}>
          <div className={styles.clockIcon} />
          {relativeTime(file.modified)}
        </div>
        <div className={styles.cardTypeIcon}>{FILE_ICONS[file.type]}</div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardTitleBlock}>
          {file.folderName && <span className={styles.cardFolder}>{file.folderName}</span>}
          <span className={styles.cardTitle}>{file.title}</span>
        </div>
        <a href={file.url} target="_blank" rel="noopener noreferrer"
           className={styles.cardOpenBtn} aria-label="Open file">
          <ArrowIcon color={ARROW_COLORS[file.type]} />
        </a>
      </div>
    </div>
  );
}

function FigmaCardInner({ file }: { file: FigmaFile }) {
  return (
    <div className={`${styles.cardImgWrap} ${styles.figmaImgWrap}`}>
      {file.thumbnailUrl
        ? <img src={file.thumbnailUrl} alt="" className={styles.cardBg} />
        : <div className={styles.figmaFallback} />}
      <div className={styles.cardOverlay} style={{ background: NEUTRAL_OVERLAY }} />
      <div className={styles.cardHeader}>
        <div className={styles.cardTimePill}>
          <div className={styles.clockIcon} />
          {relativeTime(file.lastModified)}
        </div>
        <div className={`${styles.cardTypeIcon} ${styles.figmaBadge}`}><FigmaLogo /></div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardTitleBlock}>
          <span className={styles.cardFolder}>Figma</span>
          <span className={styles.cardTitle}>{file.name}</span>
        </div>
        <a href={file.url} target="_blank" rel="noopener noreferrer"
           className={styles.cardOpenBtn} aria-label="Open in Figma">
          <ArrowIcon color="#9747FF" />
        </a>
      </div>
    </div>
  );
}

function NotionCardInner({ page }: { page: NotionPage }) {
  return (
    <div className={`${styles.cardImgWrap} ${styles.notionImgWrap}`}>
      <div className={styles.notionFallback} />
      <div className={styles.cardOverlay} style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)' }} />
      <div className={styles.cardHeader}>
        <div className={styles.cardTimePill}>
          <div className={styles.clockIcon} />
          {relativeTime(page.lastEdited)}
        </div>
        <div className={`${styles.cardTypeIcon} ${styles.notionBadge}`}>
          {page.icon ? <span className={styles.notionIcon}>{page.icon}</span> : <NotionLogo />}
        </div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardTitleBlock}>
          <span className={styles.cardFolder}>{page.objectType === 'database' ? 'Database' : 'Notion'}</span>
          <span className={styles.cardTitle}>{page.title}</span>
        </div>
        <a href={page.url} target="_blank" rel="noopener noreferrer"
           className={styles.cardOpenBtn} aria-label="Open in Notion">
          <ArrowIcon color="#E5E5E5" />
        </a>
      </div>
    </div>
  );
}

function YouTubeCardInner({ video }: { video: YouTubeVideo }) {
  return (
    <div className={`${styles.cardImgWrap} ${styles.youtubeImgWrap}`}>
      {video.thumbnailUrl
        ? <img src={video.thumbnailUrl} alt="" className={styles.cardBg} />
        : <div className={styles.youtubeFallback} />}
      <div className={styles.cardOverlay} style={{ background: NEUTRAL_OVERLAY }} />
      <div className={styles.cardHeader}>
        <div className={styles.cardTimePill}>
          <div className={styles.clockIcon} />
          {video.channelName}
        </div>
        <div className={`${styles.cardTypeIcon} ${styles.youtubeBadge}`}><YouTubeLogo /></div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardTitleBlock}>
          <span className={styles.cardFolder}>{video.channelName}</span>
          <span className={styles.cardTitle}>{video.title}</span>
        </div>
        <a href={video.url} target="_blank" rel="noopener noreferrer"
           className={styles.cardOpenBtn} aria-label="Watch on YouTube">
          <ArrowIcon color="#FF0000" />
        </a>
      </div>
    </div>
  );
}

// ── Event signal card ──────────────────────────────────────
function SignalCard({ event, index, theme, onDone }: {
  event: CadenceEvent; index: number; theme: Theme; onDone: (id: string) => void;
}) {
  const [acting, setActing] = useState(false);

  const handleDone = async () => {
    if (acting) return;
    setActing(true);
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadence_event_id: event.id, outcome: 'actioned' }),
      });
      onDone(event.id);
    } catch { setActing(false); }
  };

  return (
    <div className={`${styles.signal} ${styles[`signal_${theme}`]}`}
         style={{ top: 100 + index * 72, animationDelay: `${index * 60}ms` }}>
      <div className={styles.signalBody}>
        <span className={`${styles.signalTitle} ${styles[`signalTitle_${theme}`]}`}>{event.title}</span>
        <span className={`${styles.signalTime} ${styles[`signalTime_${theme}`]}`}>{fmtEventTime(event)}</span>
      </div>
      <button className={`${styles.doneBtn} ${styles[`doneBtn_${theme}`]}`}
              onClick={handleDone} disabled={acting} aria-label="Mark as done">✓</button>
    </div>
  );
}

// ── Gmail signal card ──────────────────────────────────────
function GmailSignalCard({ signal, index, theme, onDismiss }: {
  signal: GmailSignal; index: number; theme: Theme; onDismiss: (id: string) => void;
}) {
  return (
    <div className={`${styles.signal} ${styles.signalGmail} ${styles[`signal_${theme}`]}`}
         style={{ top: 100 + index * 72, animationDelay: `${index * 60}ms` }}>
      <div className={styles.gmailDot} />
      <div className={styles.signalBody}>
        <span className={`${styles.signalTitle} ${styles[`signalTitle_${theme}`]}`}>{signal.subject}</span>
        <span className={`${styles.signalTime} ${styles[`signalTime_${theme}`]}`}>{signal.sender} · {relativeTime(signal.receivedAt)}</span>
      </div>
      <button className={`${styles.doneBtn} ${styles[`doneBtn_${theme}`]} ${styles.doneBtnGmail}`}
              onClick={() => onDismiss(signal.id)} aria-label="Dismiss">×</button>
    </div>
  );
}

// ── Integration logos ──────────────────────────────────────
function FigmaLogo() {
  return (
    <svg width="11" height="16" viewBox="0 0 38 57" fill="none" aria-hidden="true">
      <path d="M19 28.5C19 25.48 21.46 23 24.5 23C27.54 23 30 25.48 30 28.5C30 31.52 27.54 34 24.5 34C21.46 34 19 31.52 19 28.5Z" fill="#1ABCFE"/>
      <path d="M8 39.5C8 36.48 10.46 34 13.5 34H19V39.5C19 42.52 16.54 45 13.5 45C10.46 45 8 42.52 8 39.5Z" fill="#0ACF83"/>
      <path d="M19 12V23H24.5C27.54 23 30 20.52 30 17.5C30 14.48 27.54 12 24.5 12H19Z" fill="#FF7262"/>
      <path d="M8 17.5C8 20.52 10.46 23 13.5 23H19V12H13.5C10.46 12 8 14.48 8 17.5Z" fill="#F24E1E"/>
      <path d="M8 28.5C8 31.52 10.46 34 13.5 34H19V23H13.5C10.46 23 8 25.48 8 28.5Z" fill="#FF7262"/>
    </svg>
  );
}
function NotionLogo() {
  return (
    <svg width="13" height="13" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect width="100" height="100" rx="12" fill="#fff"/>
      <path d="M29 22h42l-4 6H33l-4-6zM25 30h50v48H25V30zm8 8v32h34V38H33z" fill="#000"/>
    </svg>
  );
}
function YouTubeLogo() {
  return (
    <svg width="16" height="11" viewBox="0 0 576 404" fill="none" aria-hidden="true">
      <path d="M549.655 52.974c-6.461-24.243-25.516-43.348-49.707-49.828C456.25 0 288 0 288 0S119.75 0 76.052 3.146C51.862 9.626 32.807 28.73 26.346 52.974 0 97.07 0 202 0 202s0 104.93 26.346 149.026c6.461 24.244 25.516 43.349 49.707 49.829C119.75 404 288 404 288 404s168.25 0 211.948-3.145c24.191-6.48 43.246-25.585 49.707-49.829C576 307.93 576 202 576 202s0-104.93-26.345-149.026z" fill="#FF0000"/>
      <path d="M232 289V115l152 87-152 87z" fill="#fff"/>
    </svg>
  );
}

// ── FovealCanvas ───────────────────────────────────────────
export function FovealCanvas({ theme }: Props) {
  const { events }             = useDigest();
  const { files: allFiles }    = useDriveFiles();
  const { files: figmaFiles }  = useFigmaFiles();
  const { pages: notionPages } = useNotionPages();
  const { signals: gmailRaw }  = useGmailSignals();
  const focusEvent             = getFocusEvent(events);
  const { videos: ytVideos }   = useYouTubeVideos(focusEvent?.title);

  const [dismissed,      setDismissed]      = useState<Set<string>>(new Set());
  const [gmailDismissed, setGmailDismissed] = useState<Set<string>>(new Set());
  const [savedPos,       setSavedPos]       = useState<Record<string, Pos>>(loadPositions);

  const dismiss      = (id: string) => setDismissed((p) => new Set(p).add(id));
  const dismissGmail = (id: string) => setGmailDismissed((p) => new Set(p).add(id));

  // Called once when a grid card crosses the drag threshold
  const handleDetach = useCallback((id: string, pos: Pos) => {
    setSavedPos((prev) => ({ ...prev, [id]: pos }));
  }, []);

  // Called on mouseup — persists final position to localStorage
  const handleDrop = useCallback((id: string, pos: Pos) => {
    setSavedPos((prev) => {
      const next = { ...prev, [id]: pos };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  }, []);

  const matchedFiles = allFiles.sort((a, b) => {
    const aM = focusEvent && a.eventId === focusEvent.id ? 0 : a.eventId && a.eventId !== 'none' ? 1 : 2;
    const bM = focusEvent && b.eventId === focusEvent.id ? 0 : b.eventId && b.eventId !== 'none' ? 1 : 2;
    return aM - bM;
  });

  const now          = new Date();
  const signalEvents = events
    .filter((e) => {
      if (dismissed.has(e.id)) return false;
      const end = e.deadline ? new Date(e.deadline) : new Date(new Date(e.timestamp).getTime() + 3_600_000);
      return end >= now;
    })
    .slice(0, 3);
  const gmailSignals = gmailRaw.filter((s) => !gmailDismissed.has(s.id)).slice(0, 3);

  // Build a flat card list with stable IDs and stagger indices
  const driveOffset  = 0;
  const figmaOffset  = matchedFiles.length;
  const notionOffset = figmaOffset  + figmaFiles.length;
  const ytOffset     = notionOffset + notionPages.length;

  type CardItem = { id: string; index: number; extraClass?: string; inner: React.ReactNode };
  const allCards: CardItem[] = [
    ...matchedFiles.map((f, i) => ({ id: f.url, index: driveOffset + i,  inner: <DriveCardInner   file={f} /> })),
    ...figmaFiles  .map((f, i) => ({ id: f.url, index: figmaOffset  + i, inner: <FigmaCardInner   file={f} /> })),
    ...notionPages .map((p, i) => ({ id: p.url, index: notionOffset + i, inner: <NotionCardInner  page={p} /> })),
    ...ytVideos    .map((v, i) => ({ id: v.url, index: ytOffset     + i, inner: <YouTubeCardInner video={v} /> })),
  ];

  const gridCards     = allCards.filter((c) => !(c.id in savedPos));
  const detachedCards = allCards.filter((c) =>   c.id in savedPos);

  return (
    <div className={styles.canvas}>
      {/* ── Bento grid: cards without a saved position ── */}
      <div className={styles.grid}>
        {gridCards.map((c) => (
          <DraggableCard key={c.id} id={c.id} isDetached={false}
            index={c.index} onDetach={handleDetach} onDrop={handleDrop}>
            {c.inner}
          </DraggableCard>
        ))}
      </div>

      {/* ── Detached cards: freely positioned on the canvas ── */}
      {detachedCards.map((c) => (
        <DraggableCard key={c.id} id={c.id} isDetached pos={savedPos[c.id]}
          index={c.index} onDetach={handleDetach} onDrop={handleDrop}>
          {c.inner}
        </DraggableCard>
      ))}

      {/* ── Signal strip — fixed right ── */}
      {signalEvents.map((event, i) => (
        <SignalCard key={event.id} event={event} index={i} theme={theme} onDone={dismiss} />
      ))}
      {gmailSignals.map((signal, i) => (
        <GmailSignalCard key={signal.id} signal={signal} index={signalEvents.length + i}
          theme={theme} onDismiss={dismissGmail} />
      ))}

      {/* ── Reset layout button ── */}
      {Object.keys(savedPos).length > 0 && (
        <button className={styles.resetBtn} onClick={resetLayout}>
          Reset layout
        </button>
      )}
    </div>
  );
}
