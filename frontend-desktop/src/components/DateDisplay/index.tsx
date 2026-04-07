import { useState, useEffect, useRef } from 'react';
import {
  format, addDays, addMonths, subMonths,
  startOfWeek, startOfMonth,
  isToday, isSameDay, isSameMonth, parseISO,
} from 'date-fns';
import type { CadenceEvent } from '../../types';
import styles from './DateDisplay.module.css';

// ── Icons ─────────────────────────────────────────────────
function PenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.5 1.5l3 3-9.5 9.5H1.5v-3l9.5-9.5z"
        stroke="white"
        strokeWidth="1.4"
        strokeOpacity="0.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Stored draft shape ─────────────────────────────────────
interface StoredDraft {
  type:    'email' | 'document';
  to:      string;
  subject: string;
  content: string;
}

// ── Helpers ────────────────────────────────────────────────
function fmtEventTime(event: CadenceEvent): string {
  const start = parseISO(event.timestamp);
  if (event.deadline) {
    return `${format(start, 'h:mm')}–${format(parseISO(event.deadline), 'h:mmaaa')}`;
  }
  return format(start, 'h:mmaaa');
}

function getEventsForDay(events: CadenceEvent[], day: Date): CadenceEvent[] {
  console.log(`[Notch Calendar] events received: ${events.length}, dates:`,
    events.map(e => new Date(e.timestamp).toDateString())
  );
  return events
    .filter((e) => new Date(e.timestamp).toDateString() === day.toDateString())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 5);
}

// ── Inline dark mini-calendar ──────────────────────────────
function MiniCalendar({ events, isOpen }: { events: CadenceEvent[]; isOpen: boolean }) {
  const [viewMonth,   setViewMonth]   = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setSelectedDay(now);
      setViewMonth(now);
    }
  }, [isOpen]);

  const monthStart = startOfMonth(viewMonth);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days       = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const eventDays = new Set(
    events.map((e) => format(parseISO(e.timestamp), 'yyyy-MM-dd'))
  );

  const selectedEvents = getEventsForDay(events, selectedDay);

  return (
    <div className={styles.calPanel}>
      <div className={styles.calHeader}>
        <button className={styles.calNavBtn} onClick={() => setViewMonth((m) => subMonths(m, 1))} aria-label="Previous month">‹</button>
        <span className={styles.calMonthTitle}>{format(viewMonth, 'MMMM yyyy')}</span>
        <button className={styles.calNavBtn} onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month">›</button>
      </div>

      <div className={styles.calDayHeaders}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className={styles.calDayHeader}>{d}</span>
        ))}
      </div>

      <div className={styles.calDayGrid}>
        {days.map((day) => {
          const inMonth  = isSameMonth(day, viewMonth);
          const today    = isToday(day);
          const selected = isSameDay(day, selectedDay);
          const hasEvent = eventDays.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              className={[
                styles.calDayCell,
                today              ? styles.calDayCellToday    : '',
                selected && !today ? styles.calDayCellSelected : '',
                !inMonth           ? styles.calDayCellOther    : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(day)}
            >
              <span className={styles.calDayNum}>{format(day, 'd')}</span>
              {hasEvent && <span className={styles.calDayDot} />}
            </button>
          );
        })}
      </div>

      <div className={styles.calEventsDivider} />

      <div className={styles.calEvents}>
        {selectedEvents.length === 0 ? (
          <span className={styles.calNoEvents}>Nothing scheduled</span>
        ) : (
          selectedEvents.map((e) => (
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

// ── Pending Draft Panel (shows draft from localStorage) ────
type SendState = 'idle' | 'sending' | 'success' | 'error' | 'missingFields';

function PendingDraftPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [draft,     setDraft]     = useState<StoredDraft | null>(null);
  const [to,        setTo]        = useState('');
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [toError,   setToError]   = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');

  const toValid = to.includes('@');

  useEffect(() => {
    if (isOpen) {
      const raw = localStorage.getItem('cadence_active_draft');
      if (raw) {
        try {
          const stored = JSON.parse(raw) as StoredDraft;
          setDraft(stored);
          setTo(stored.to ?? '');
          setSubject(stored.subject ?? '');
          setBody(stored.content);
        } catch {}
      }
      setToError(false);
      setSendState('idle');
    }
  }, [isOpen]);

  const sendEmail = async () => {
    if (!draft) return;
    if (!toValid) {
      setToError(true);
      return;
    }
    setToError(false);
    setSendState('sending');
    try {
      const res = await fetch('http://localhost:3001/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to, subject, body }),
      });
      if (!res.ok) throw new Error('send failed');
      setSendState('success');
      setTimeout(() => {
        localStorage.removeItem('cadence_active_draft');
        window.dispatchEvent(new CustomEvent('cadenceDraftReady'));
        onClose();
      }, 2000);
    } catch {
      setSendState('error');
      setTimeout(() => setSendState('idle'), 3000);
    }
  };

  const saveDraft = () => {
    const blob = new Blob([body], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'draft.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = body
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>Document</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;line-height:1.7;color:#111;font-size:15px;}pre{white-space:pre-wrap;font-family:inherit;}</style>
</head><body><pre>${esc}</pre><script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  };

  const discard = () => {
    localStorage.removeItem('cadence_active_draft');
    window.dispatchEvent(new CustomEvent('cadenceDraftReady'));
    onClose();
  };

  if (!draft) return null;

  return (
    <div className={styles.draftingPanel}>
      <div className={styles.draftingLabel}>
        {draft.type === 'email' ? 'Email Draft' : 'Document'}
      </div>

      {draft.type === 'email' && (
        <div className={styles.draftingMeta}>
          <div className={styles.draftingMetaRow}>
            <span className={styles.draftingMetaKey}>To</span>
            <input
              className={`${styles.draftingMetaInput} ${toError ? styles.draftingMetaInputError : ''}`}
              value={to}
              placeholder="recipient@example.com"
              onChange={(e) => {
                setTo(e.target.value);
                if (toError && e.target.value.includes('@')) setToError(false);
              }}
            />
          </div>
          {!toValid && (
            <span className={styles.draftingToWarning}>
              ⚠ Add an email address to send (e.g. max@gmail.com)
            </span>
          )}
          {toError && toValid && (
            <span className={styles.draftingToErrorMsg}>
              Please enter a valid email address (e.g. mabel@email.com)
            </span>
          )}
          <div className={styles.draftingMetaRow}>
            <span className={styles.draftingMetaKey}>Sub</span>
            <input
              className={styles.draftingMetaInput}
              value={subject}
              placeholder="Subject"
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
      )}

      <textarea
        className={`${styles.draftingTextarea} ${styles.draftingTextareaResult}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={9}
      />

      {sendState === 'success' && (
        <span className={styles.draftingSendSuccess}>Sent ✓</span>
      )}
      {sendState === 'error' && (
        <span className={styles.draftingSendError}>Failed — check connection</span>
      )}

      <div className={styles.draftingActions}>
        {draft.type === 'email' ? (
          <>
            <button
              className={styles.draftingNextBtn}
              onClick={sendEmail}
              disabled={!toValid || sendState === 'sending' || sendState === 'success'}
              style={!toValid ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              {sendState === 'sending' ? 'Sending…' : 'Send'}
            </button>
            <button className={styles.draftingChoiceBtn} onClick={saveDraft}>Save Draft</button>
          </>
        ) : (
          <button className={styles.draftingNextBtn} onClick={exportPDF}>Export as PDF</button>
        )}
        <button className={styles.draftingDiscardBtn} onClick={discard}>Discard</button>
      </div>
    </div>
  );
}

// ── Main notch component ───────────────────────────────────
type View = 'none' | 'calendar' | 'drafting';

export function DateDisplay() {
  const [now,       setNow]       = useState(() => new Date());
  const [view,      setView]      = useState<View>('none');
  const [hasDraft,  setHasDraft]  = useState(() => !!localStorage.getItem('cadence_active_draft'));
  const [calEvents, setCalEvents] = useState<CadenceEvent[]>([]);
  const notchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Fetch calendar events
  useEffect(() => {
    const load = () =>
      fetch('http://localhost:3001/events')
        .then((r) => r.json())
        .then((data: CadenceEvent[]) => setCalEvents(data))
        .catch(() => {});
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Track localStorage draft key — listen to same-tab custom event + cross-tab storage event
  useEffect(() => {
    const sync = () => setHasDraft(!!localStorage.getItem('cadence_active_draft'));
    window.addEventListener('cadenceDraftReady', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cadenceDraftReady', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Collapse drafting view if draft is cleared while open
  useEffect(() => {
    if (!hasDraft && view === 'drafting') setView('none');
  }, [hasDraft, view]);

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

  const monthText  = format(now, 'MMM') + '.';
  const dayText    = format(now, 'd');
  const isExpanded = view !== 'none';

  const toggleCalendar = () => setView((v) => (v === 'calendar'  ? 'none' : 'calendar'));
  const toggleDrafting = () => setView((v) => (v === 'drafting'  ? 'none' : 'drafting'));

  return (
    <div
      ref={notchRef}
      className={`${styles.notch} ${isExpanded ? styles.notchExpanded : ''}`}
    >
      {/* ── Header strip ───────────────────────────────────── */}
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

        {/* Pen icon — only visible when a draft is pending */}
        {hasDraft && (
          <button
            className={`${styles.iconBtn} ${view === 'drafting' ? styles.iconBtnActive : ''}`}
            onClick={toggleDrafting}
            aria-label="View pending draft"
            aria-expanded={view === 'drafting'}
          >
            <PenIcon />
          </button>
        )}
      </div>

      {/* ── Calendar expand ──────────────────────────────────── */}
      <div className={`${styles.expandWrapper} ${view === 'calendar' ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          <MiniCalendar events={calEvents} isOpen={view === 'calendar'} />
        </div>
      </div>

      {/* ── Pending draft expand ─────────────────────────────── */}
      <div className={`${styles.expandWrapper} ${view === 'drafting' ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          <PendingDraftPanel
            isOpen={view === 'drafting'}
            onClose={() => setView('none')}
          />
        </div>
      </div>
    </div>
  );
}
