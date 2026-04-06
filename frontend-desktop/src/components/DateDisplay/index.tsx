import { useState, useEffect, useRef } from 'react';
import {
  format, addDays, addMonths, subMonths,
  startOfWeek, startOfMonth,
  isToday, isSameDay, isSameMonth, parseISO,
} from 'date-fns';
import type { CadenceEvent } from '../../types';
import styles from './DateDisplay.module.css';

interface Props {
  events:       CadenceEvent[];
  draft:        { type: 'email' | 'document'; content: string } | null;
  onDraftClear: () => void;
}

type View = 'none' | 'calendar' | 'draft';

// ── Helpers ────────────────────────────────────────────────
function fmtEventTime(event: CadenceEvent): string {
  const start = parseISO(event.timestamp);
  if (event.deadline) {
    return `${format(start, 'h:mm')}–${format(parseISO(event.deadline), 'h:mmaaa')}`;
  }
  return format(start, 'h:mmaaa');
}

function getTodayEvents(events: CadenceEvent[]): CadenceEvent[] {
  const todayStr = new Date().toLocaleDateString();
  console.log(`[Notch Calendar] events received: ${events.length}, dates:`,
    events.map(e => new Date(e.timestamp).toLocaleDateString())
  );
  return events
    .filter((e) => new Date(e.timestamp).toLocaleDateString() === todayStr)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 5);
}

// ── Inline dark mini-calendar ──────────────────────────────
function MiniCalendar({ events }: { events: CadenceEvent[] }) {
  const [viewMonth,   setViewMonth]   = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const monthStart = startOfMonth(viewMonth);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days       = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const eventDays = new Set(
    events.map((e) => format(parseISO(e.timestamp), 'yyyy-MM-dd'))
  );

  const todayEvents = getTodayEvents(events);

  return (
    <div className={styles.calPanel}>
      {/* Month navigation */}
      <div className={styles.calHeader}>
        <button
          className={styles.calNavBtn}
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >‹</button>
        <span className={styles.calMonthTitle}>{format(viewMonth, 'MMMM yyyy')}</span>
        <button
          className={styles.calNavBtn}
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div className={styles.calDayHeaders}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className={styles.calDayHeader}>{d}</span>
        ))}
      </div>

      {/* Date grid */}
      <div className={styles.calDayGrid}>
        {days.map((day) => {
          const inMonth  = isSameMonth(day, viewMonth);
          const today    = isToday(day);
          const selected = isSameDay(day, selectedDay) && !today;
          const hasEvent = eventDays.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              className={[
                styles.calDayCell,
                today    ? styles.calDayCellToday    : '',
                selected ? styles.calDayCellSelected : '',
                !inMonth ? styles.calDayCellOther    : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(day)}
            >
              <span className={styles.calDayNum}>{format(day, 'd')}</span>
              {hasEvent && <span className={styles.calDayDot} />}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className={styles.calEventsDivider} />

      {/* Today's events */}
      <div className={styles.calEvents}>
        {todayEvents.length === 0 ? (
          <span className={styles.calNoEvents}>Nothing scheduled today</span>
        ) : (
          todayEvents.map((e) => (
            <div key={e.id} className={styles.calEventRow}>
              <span className={styles.calEventTitle}>{e.title}</span>
              <span className={styles.calEventTime}>{fmtEventTime(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main notch component ───────────────────────────────────
export function DateDisplay({ events, draft, onDraftClear }: Props) {
  const [now,  setNow]  = useState(() => new Date());
  const [view, setView] = useState<View>('none');
  const notchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Auto-switch to draft view when new draft arrives
  useEffect(() => {
    if (draft) setView('draft');
  }, [draft]);

  // Close on outside click
  useEffect(() => {
    if (view === 'none') return;
    const handler = (e: MouseEvent) => {
      if (notchRef.current && !notchRef.current.contains(e.target as Node)) {
        setView('none');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [view]);

  const monthText = format(now, 'MMM') + '.';
  const dayText   = format(now, 'd');
  const isExpanded = view !== 'none';

  const toggleCalendar = () => setView((v) => (v === 'calendar' ? 'none' : 'calendar'));

  const closeDraft = () => {
    onDraftClear();
    setView('none');
  };

  const exportDoc = () => {
    if (!draft) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = draft.content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>Draft</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;line-height:1.7;color:#111;font-size:15px;}pre{white-space:pre-wrap;font-family:inherit;}</style>
</head><body><pre>${esc}</pre><script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  };

  const copyDraft = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.content);
  };

  return (
    <div
      ref={notchRef}
      className={`${styles.notch} ${isExpanded ? styles.notchExpanded : ''}`}
    >
      {/* ── Header strip — always visible at 52px ──────────── */}
      <div className={styles.header}>
        <span className={styles.month}>{monthText}</span>

        <button
          className={styles.dayCircleBtn}
          onClick={toggleCalendar}
          aria-label="Toggle calendar"
          aria-expanded={view === 'calendar'}
        >
          <span className={styles.day}>{dayText}</span>
        </button>

        <div className={styles.divider} />
      </div>

      {/* ── Calendar expand (grid trick for smooth height) ──── */}
      <div className={`${styles.expandWrapper} ${view === 'calendar' ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          <MiniCalendar events={events} />
        </div>
      </div>

      {/* ── Draft expand ────────────────────────────────────── */}
      <div className={`${styles.expandWrapper} ${view === 'draft' && draft ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          {draft && (
            <div className={styles.draftPanel}>
              <div className={styles.draftPanelHeader}>
                <span className={styles.draftPanelLabel}>
                  {draft.type === 'email' ? 'Email Draft' : 'Document'}
                </span>
                <button
                  className={styles.draftPanelClose}
                  onClick={closeDraft}
                  aria-label="Close draft"
                >×</button>
              </div>
              <div className={styles.draftPanelContent}>{draft.content}</div>
              <div className={styles.draftPanelActions}>
                {draft.type === 'email' ? (
                  <button className={styles.draftPanelBtn} onClick={copyDraft}>Send</button>
                ) : (
                  <button className={styles.draftPanelBtn} onClick={exportDoc}>Export</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
