import { useState, useEffect, useRef } from 'react';
import {
  format, addDays, addMonths, subMonths,
  startOfWeek, startOfMonth,
  isToday, isSameDay, isSameMonth, parseISO,
} from 'date-fns';
import type { CadenceEvent } from '../../types';
import styles from './DateDisplay.module.css';

interface Props {
  draft:        { type: 'email' | 'document'; content: string } | null;
  onDraftClear: () => void;
}

type View = 'none' | 'calendar' | 'draft' | 'drafting';

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

  // Reset to today whenever the panel is opened
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

      {/* Divider */}
      <div className={styles.calEventsDivider} />

      {/* Selected day's events */}
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

// ── Drafting Table ─────────────────────────────────────────
type DraftStep = 'type' | 'context' | 'idea' | 'generating' | 'done';
type DraftDocType = 'email' | 'document';
type DraftTone = 'formal' | 'casual' | 'direct';

function DraftingPanel({ isOpen }: { isOpen: boolean }) {
  const [step,      setStep]      = useState<DraftStep>('type');
  const [docType,   setDocType]   = useState<DraftDocType | null>(null);
  const [recipient, setRecipient] = useState('');
  const [tone,      setTone]      = useState<DraftTone | null>(null);
  const [idea,      setIdea]      = useState('');
  const [generated, setGenerated] = useState('');
  const [streaming, setStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Reset all state when panel opens
  useEffect(() => {
    if (isOpen) {
      abortRef.current?.abort();
      setStep('type');
      setDocType(null);
      setRecipient('');
      setTone(null);
      setIdea('');
      setGenerated('');
      setStreaming(false);
    }
    return () => { if (!isOpen) abortRef.current?.abort(); };
  }, [isOpen]);

  const generate = async () => {
    if (!docType || !tone || !idea.trim()) return;
    setStep('generating');
    setGenerated('');
    setStreaming(true);

    const recipientPart = recipient.trim() ? ` for ${recipient.trim()}` : '';
    const prompt = docType === 'email'
      ? `Draft a ${tone} email${recipientPart}. The idea: ${idea.trim()}.\n\nFormat:\nSubject: [subject line]\n\n[email body with greeting and sign-off]`
      : `Draft a ${tone} document${recipientPart}. The idea: ${idea.trim()}.\n\nInclude a clear title and organized sections.`;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('http://localhost:3001/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt }),
        signal:  controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('bad response');
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setGenerated((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setGenerated('Unable to generate draft. Is Ollama running?');
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStep('done');
    }
  };

  const sendEmail = () => {
    fetch('http://localhost:3001/send-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to: recipient, body: generated }),
    }).catch(() => {});
  };

  const saveDraft = () => {
    const blob = new Blob([generated], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'draft.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = generated
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>Document</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;line-height:1.7;color:#111;font-size:15px;}pre{white-space:pre-wrap;font-family:inherit;}</style>
</head><body><pre>${esc}</pre><script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className={styles.draftingPanel}>
      {/* Step 1 — type */}
      {step === 'type' && (
        <>
          <p className={styles.draftingPrompt}>What are you drafting?</p>
          <div className={styles.draftingBtnRow}>
            <button
              className={styles.draftingChoiceBtn}
              onClick={() => { setDocType('email'); setStep('context'); }}
            >Email</button>
            <button
              className={styles.draftingChoiceBtn}
              onClick={() => { setDocType('document'); setStep('context'); }}
            >Document</button>
          </div>
        </>
      )}

      {/* Step 2 — context */}
      {step === 'context' && (
        <>
          <p className={styles.draftingPrompt}>Who is it for, and what's the tone?</p>
          <input
            className={styles.draftingInput}
            placeholder={docType === 'email' ? 'Recipient name or email' : 'Audience (optional)'}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setTone(tone ?? 'casual'); }}
            autoFocus
          />
          <div className={styles.draftingBtnRow}>
            {(['formal', 'casual', 'direct'] as DraftTone[]).map((t) => (
              <button
                key={t}
                className={`${styles.draftingChoiceBtn} ${tone === t ? styles.draftingChoiceBtnActive : ''}`}
                onClick={() => setTone(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button
            className={styles.draftingNextBtn}
            disabled={!tone}
            onClick={() => { if (tone) setStep('idea'); }}
          >Next →</button>
        </>
      )}

      {/* Step 3 — idea */}
      {step === 'idea' && (
        <>
          <p className={styles.draftingPrompt}>What's the idea?</p>
          <textarea
            className={styles.draftingTextarea}
            placeholder={
              docType === 'email'
                ? 'e.g. ask Sarah if she wants coffee next week'
                : 'e.g. notes on the Q3 review meeting'
            }
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            autoFocus
          />
          <button
            className={styles.draftingNextBtn}
            disabled={!idea.trim()}
            onClick={generate}
          >Generate</button>
        </>
      )}

      {/* Step 4 — generating / done */}
      {(step === 'generating' || step === 'done') && (
        <>
          <div className={styles.draftingLabel}>
            {docType === 'email' ? 'Email Draft' : 'Document'}
            {streaming && <span className={styles.draftingCursor} />}
          </div>
          <textarea
            className={`${styles.draftingTextarea} ${styles.draftingTextareaResult}`}
            value={generated}
            onChange={(e) => setGenerated(e.target.value)}
            rows={9}
            readOnly={streaming}
          />
          {step === 'done' && (
            <div className={styles.draftingActions}>
              {docType === 'email' ? (
                <>
                  <button className={styles.draftingNextBtn} onClick={sendEmail}>Send</button>
                  <button className={styles.draftingChoiceBtn} onClick={saveDraft}>Save Draft</button>
                </>
              ) : (
                <button className={styles.draftingNextBtn} onClick={exportPDF}>Export as PDF</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main notch component ───────────────────────────────────
export function DateDisplay({ draft, onDraftClear }: Props) {
  const [now,        setNow]        = useState(() => new Date());
  const [view,       setView]       = useState<View>('none');
  const [calEvents,  setCalEvents]  = useState<CadenceEvent[]>([]);
  const notchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Fetch calendar events directly from backend
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

  // Auto-switch to draft view when new draft arrives from AgentWidget
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

  const monthText  = format(now, 'MMM') + '.';
  const dayText    = format(now, 'd');
  const isExpanded = view !== 'none';

  const toggleCalendar = () => setView((v) => (v === 'calendar' ? 'none' : 'calendar'));
  const toggleDrafting = () => setView((v) => (v === 'drafting' ? 'none' : 'drafting'));

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

        <button
          className={`${styles.iconBtn} ${view === 'drafting' ? styles.iconBtnActive : ''}`}
          onClick={toggleDrafting}
          aria-label="Toggle drafting table"
          aria-expanded={view === 'drafting'}
        >
          <PenIcon />
        </button>
      </div>

      {/* ── Calendar expand ──────────────────────────────────── */}
      <div className={`${styles.expandWrapper} ${view === 'calendar' ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          <MiniCalendar events={calEvents} isOpen={view === 'calendar'} />
        </div>
      </div>

      {/* ── Drafting table expand ────────────────────────────── */}
      <div className={`${styles.expandWrapper} ${view === 'drafting' ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandInner}>
          <DraftingPanel isOpen={view === 'drafting'} />
        </div>
      </div>

      {/* ── External draft expand (from AgentWidget) ─────────── */}
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
