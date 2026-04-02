import { useState, useEffect, useRef } from 'react';
import {
  format, parseISO, addDays, addMonths, subMonths,
  startOfWeek, startOfMonth, isToday, isSameDay, isSameMonth,
} from 'date-fns';
import type { Attendee, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import { useDriveFiles } from '../../hooks/useDriveFiles';
import styles from './CalendarWidget.module.css';

interface Props {
  theme: Theme;
  events: CadenceEvent[];
  onClose: () => void;
  onBeginSession: (event: CadenceEvent) => void;
}

const COGNITIVE_META: Record<string, { color: string; label: string }> = {
  authorizational: { color: '#5b8cf7', label: 'Auth' },
  action_bound:    { color: '#f7c05b', label: 'Action' },
  conflict:        { color: '#f75b5b', label: 'Conflict' },
  informational:   { color: '#B8BEC6', label: 'Info' },
  deadline:        { color: '#B8BEC6', label: 'Deadline' },
};

const HOUR_HEIGHT = 52;

function fmt12(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}

function isComplete(event: CadenceEvent): boolean {
  const end = event.deadline ? new Date(event.deadline) : new Date(event.timestamp);
  return end < new Date();
}

function isActive(event: CadenceEvent, now: Date): boolean {
  const start = new Date(event.timestamp);
  const end = event.deadline
    ? new Date(event.deadline)
    : new Date(start.getTime() + 3_600_000);
  return start <= now && now <= end;
}

function daysBetween(a: Date, b: Date): number {
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((midnight(b) - midnight(a)) / 86_400_000);
}

function getDayLabel(selectedDay: Date, now: Date): string {
  const diff = daysBetween(now, selectedDay);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 21) return `In ${diff} days`;
  return '';
}

function eventEndMs(e: CadenceEvent): number {
  return e.deadline
    ? new Date(e.deadline).getTime()
    : new Date(e.timestamp).getTime() + 3_600_000;
}

interface EventLayout {
  event:    CadenceEvent;
  top:      number;
  height:   number;
  colIndex: number;
  colCount: number;
}

function layoutDayEvents(events: CadenceEvent[]): EventLayout[] {
  if (events.length === 0) return [];

  const parent = new Map<string, string>(events.map((e) => [e.id, e.id]));

  function find(id: string): string {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const aS = new Date(events[i].timestamp).getTime();
      const aE = eventEndMs(events[i]);
      const bS = new Date(events[j].timestamp).getTime();
      const bE = eventEndMs(events[j]);
      if (aS < bE && bS < aE) {
        parent.set(find(events[i].id), find(events[j].id));
      }
    }
  }

  const clusters = new Map<string, CadenceEvent[]>();
  for (const e of events) {
    const root = find(e.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(e);
  }

  const result: EventLayout[] = [];

  for (const cluster of clusters.values()) {
    const sorted = [...cluster].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const colEnds: number[] = [];
    const colAssign = new Map<string, number>();

    for (const e of sorted) {
      const start = new Date(e.timestamp).getTime();
      let col = colEnds.findIndex((t) => t <= start);
      if (col === -1) { col = colEnds.length; colEnds.push(0); }
      colAssign.set(e.id, col);
      colEnds[col] = eventEndMs(e);
    }

    const colCount = colEnds.length;

    for (const e of cluster) {
      const start  = parseISO(e.timestamp);
      const startH = start.getHours() + start.getMinutes() / 60;
      const durH   = (eventEndMs(e) - new Date(e.timestamp).getTime()) / 3_600_000;
      result.push({
        event:    e,
        top:      startH * HOUR_HEIGHT,
        height:   Math.max(durH * HOUR_HEIGHT, 28),
        colIndex: colAssign.get(e.id)!,
        colCount,
      });
    }
  }

  return result;
}

function MonthCalendar({
  viewMonth, selectedDay, events, onDaySelect, onPrev, onNext,
}: {
  viewMonth:   Date;
  selectedDay: Date;
  events:      CadenceEvent[];
  onDaySelect: (d: Date) => void;
  onPrev:      () => void;
  onNext:      () => void;
}) {
  const monthStart = startOfMonth(viewMonth);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days       = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const eventDays = new Set(
    events.map((e) => format(parseISO(e.timestamp), 'yyyy-MM-dd'))
  );

  return (
    <div className={styles.monthCal}>
      <div className={styles.monthHeader}>
        <button className={styles.navBtn} onClick={onPrev} aria-label="Previous month">‹</button>
        <span className={styles.monthTitle}>{format(viewMonth, 'MMMM yyyy')}</span>
        <button className={styles.navBtn} onClick={onNext} aria-label="Next month">›</button>
      </div>

      <div className={styles.dayHeaders}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className={styles.dayHeader}>{d}</span>
        ))}
      </div>

      <div className={styles.dayGrid}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const today   = isToday(day);
          const selected = isSameDay(day, selectedDay);
          const hasEvent = eventDays.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              className={[
                styles.dayCell,
                today    ? styles.dayCellToday    : '',
                selected ? styles.dayCellSelected : '',
                !inMonth ? styles.dayCellOther    : '',
              ].join(' ')}
              onClick={() => onDaySelect(day)}
            >
              <span className={styles.dayNum}>{format(day, 'd')}</span>
              {hasEvent && <span className={styles.dayDot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function detailInitials(a: Attendee): string {
  if (a.name) {
    const parts = a.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return a.email.slice(0, 2).toUpperCase();
}

const DETAIL_STATUS: Record<Attendee['status'], string> = {
  accepted:    '✓ Going',
  tentative:   '? Maybe',
  needsAction: '— Pending',
  declined:    '✗ Declined',
};

type DriveFileType = 'doc' | 'slides' | 'sheet' | 'pdf';

interface DriveFile {
  title:    string;
  url:      string;
  type:     DriveFileType;
  modified: string;
  eventId?: string;
}

const DRIVE_ICONS: Record<DriveFileType, string> = {
  doc:    '📄',
  slides: '📊',
  sheet:  '📋',
  pdf:    '📕',
};

function EventDetail({
  event, driveFiles, onBack, onBegin,
}: {
  event:      CadenceEvent;
  driveFiles: DriveFile[];
  onBack:     () => void;
  onBegin:    (e: CadenceEvent) => void;
}) {
  const matchedFiles = driveFiles.filter((f) => f.eventId === event.id);
  const timeLabel = event.deadline
    ? `${fmt12(event.timestamp)} – ${fmt12(event.deadline)}`
    : fmt12(event.timestamp);
  const dateLabel = format(parseISO(event.timestamp), 'EEEE, MMMM d');

  const attendees = Array.isArray(event.attendees) && event.attendees.length > 0
    ? event.attendees as Attendee[]
    : null;

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <button className={styles.detailBack} onClick={onBack} aria-label="Back to timeline">
          ← Back
        </button>
      </div>

      <div className={styles.detailScroll}>
        <h3 className={styles.detailTitle}>{event.title}</h3>
        <p className={styles.detailTime}>{dateLabel} · {timeLabel}</p>

        {event.location && (
          <p className={styles.detailRow}>📍 {event.location}</p>
        )}

        {attendees && (
          <div className={styles.detailSection}>
            {attendees.map((a) => (
              <div key={a.email} className={styles.detailAttendee}>
                <span className={styles.detailAvatar}>{detailInitials(a)}</span>
                <span className={styles.detailAttendeeInfo}>
                  <span className={styles.detailAttendeeName}>
                    {a.name ?? a.email}
                    {a.organiser && <span className={styles.detailOrgTag}>org</span>}
                  </span>
                  <span className={`${styles.detailStatus} ${styles[`dStatus_${a.status}`]}`}>
                    {DETAIL_STATUS[a.status]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {matchedFiles.length > 0 && (
          <div className={styles.detailSection}>
            {matchedFiles.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.driveFile}
              >
                <span className={styles.driveIcon}>{DRIVE_ICONS[f.type]}</span>
                <span className={styles.driveTitle}>{f.title}</span>
                <span className={styles.driveArrow}>→</span>
              </a>
            ))}
          </div>
        )}

        {event.raw_content && (
          <p className={styles.detailNotes}>{event.raw_content}</p>
        )}

        {event.reminder_minutes != null && (
          <p className={styles.detailRow}>🔔 {event.reminder_minutes} minutes before</p>
        )}
      </div>

      <div className={styles.detailFooter}>
        <button className={styles.detailBegin} onClick={() => onBegin(event)}>
          → Begin session
        </button>
      </div>
    </div>
  );
}

function TimelineEvent({
  event, top, height, colIndex, colCount,
  complete: done, active: live, onSelect,
}: {
  event:    CadenceEvent;
  top:      number;
  height:   number;
  colIndex: number;
  colCount: number;
  complete: boolean;
  active:   boolean;
  onSelect: (e: CadenceEvent) => void;
}) {
  const meta   = COGNITIVE_META[event.cognitive_type] ?? COGNITIVE_META.informational;
  const shadow = live ? `inset 3px 0 10px ${meta.color}50` : undefined;
  const tiny   = height < 48;

  const GAP = colCount > 1 ? 2 : 0;
  const lFrac = (colIndex / colCount).toFixed(8);
  const rFrac = ((colCount - colIndex - 1) / colCount).toFixed(8);
  const left  = colCount === 1
    ? '52px'
    : `calc(52px + ${lFrac} * (100% - 72px) + ${colIndex > 0 ? GAP : 0}px)`;
  const right = colCount === 1
    ? '20px'
    : `calc(20px + ${rFrac} * (100% - 72px) + ${colIndex < colCount - 1 ? GAP : 0}px)`;

  const timeLabel = event.deadline
    ? `${fmt12(event.timestamp)} – ${fmt12(event.deadline)}`
    : fmt12(event.timestamp);

  return (
    <div
      className={[
        styles.tlEvent,
        done ? styles.tlEventDone : '',
        tiny ? styles.tlEventTiny : '',
      ].join(' ')}
      style={{
        top, left, right,
        borderLeftColor: meta.color,
        boxShadow: shadow,
        '--card-h': `${height}px`,
      } as React.CSSProperties}
      title={tiny ? event.title : undefined}
      onClick={() => onSelect(event)}
    >
      <span className={styles.tlTitle}>{event.title}</span>
      <span className={styles.tlTime}>{timeLabel}</span>
      {event.location && (
        <span className={styles.tlLocation}>📍 {event.location}</span>
      )}
    </div>
  );
}

function DayTimeline({
  events, selectedDay, now, onSelect,
}: {
  events:      CadenceEvent[];
  selectedDay: Date;
  now:         Date;
  onSelect:    (e: CadenceEvent) => void;
}) {
  const scrollRef       = useRef<HTMLDivElement>(null);
  const isSelectedToday = isToday(selectedDay);
  const daysAhead       = daysBetween(now, selectedDay);
  const isBeyondRange   = daysAhead > 21;

  const dayEvents = events.filter((e) => isSameDay(parseISO(e.timestamp), selectedDay));
  const laid      = layoutDayEvents(dayEvents);
  const dayLabel  = getDayLabel(selectedDay, now);

  useEffect(() => {
    if (!isSelectedToday || !scrollRef.current) return;
    const openedAt   = new Date();
    const currentTop = (openedAt.getHours() + openedAt.getMinutes() / 60) * HOUR_HEIGHT;
    scrollRef.current.scrollTop = currentTop - scrollRef.current.clientHeight / 2;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nowTop = isSelectedToday
    ? (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT
    : null;

  return (
    <>
      <div className={styles.tlSectionHeader}>
        <span className={styles.tlSectionLabel}>
          {format(selectedDay, 'EEEE, MMMM d')}
        </span>
        {dayLabel && <span className={styles.tlDayAhead}>{dayLabel}</span>}
      </div>

      {isBeyondRange ? (
        <div className={styles.tlBeyondRange}>
          Sync extends 21 days ahead
        </div>
      ) : (
        <div className={styles.tlScroll} ref={scrollRef}>
          <div className={styles.tlInner}>

            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className={styles.hourRow} style={{ top: h * HOUR_HEIGHT }}>
                <span className={styles.hourLabel}>{String(h).padStart(2, '0')}:00</span>
                <div className={styles.hourLine} />
              </div>
            ))}

            {nowTop !== null && (
              <div className={styles.nowLine} style={{ top: nowTop }}>
                <span className={styles.nowLabel}>{format(now, 'HH:mm')}</span>
                <span className={styles.nowDot} />
                <div className={styles.nowBar} />
              </div>
            )}

            {laid.map(({ event, top, height, colIndex, colCount }) => (
              <TimelineEvent
                key={event.id}
                event={event}
                top={top}
                height={height}
                colIndex={colIndex}
                colCount={colCount}
                complete={isComplete(event)}
                active={isActive(event, now)}
                onSelect={onSelect}
              />
            ))}

          </div>
        </div>
      )}
    </>
  );
}

export function CalendarWidget({ theme, events, onClose, onBeginSession }: Props) {
  const [viewMonth,     setViewMonth]     = useState(() => new Date());
  const [selectedDay,   setSelectedDay]   = useState(() => new Date());
  const [now,           setNow]           = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CadenceEvent | null>(null);
  const { files: driveFiles } = useDriveFiles();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel} data-theme={theme}>

        <div className={styles.panelTopRow}>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close calendar"
          >
            ×
          </button>
        </div>

        <MonthCalendar
          viewMonth={viewMonth}
          selectedDay={selectedDay}
          events={events}
          onDaySelect={setSelectedDay}
          onPrev={() => setViewMonth((m) => subMonths(m, 1))}
          onNext={() => setViewMonth((m) => addMonths(m, 1))}
        />

        <div className={styles.divider} />

        <div className={styles.timelineContainer}>
          <DayTimeline
            events={events}
            selectedDay={selectedDay}
            now={now}
            onSelect={setSelectedEvent}
          />

          {selectedEvent && (
            <EventDetail
              event={selectedEvent}
              driveFiles={driveFiles}
              onBack={() => setSelectedEvent(null)}
              onBegin={(e) => { setSelectedEvent(null); onBeginSession(e); }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
