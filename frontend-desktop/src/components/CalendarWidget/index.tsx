import { useState } from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import type { CadenceEvent } from '../../types';
import { useDigest } from '../../hooks/useDigest';
import { useEventHorizon } from '../../hooks/useEventHorizon';
import { EventHorizon } from '../EventHorizon';
import styles from './CalendarWidget.module.css';

interface Props {
  onBeginSession: (event: CadenceEvent) => void;
}

const COGNITIVE_LABELS: Record<string, string> = {
  authorizational: 'auth',
  action_bound: 'action',
  conflict: 'conflict',
  informational: 'info',
  deadline: 'deadline',
};

function EventRow({ event, onBegin }: { event: CadenceEvent; onBegin: (e: CadenceEvent) => void }) {
  const { isApproaching } = useEventHorizon(event);
  const opacity = event.score >= 90 ? 1 : 0.7;

  return (
    <div
      className={`${styles.eventRow} ${isApproaching ? styles.approaching : ''}`}
      style={{ opacity }}
    >
      <div className={styles.eventMain}>
        <span className={styles.eventTitle}>{event.title}</span>
        <span className={`${styles.badge} ${styles[`badge_${event.cognitive_type}`]}`}>
          {COGNITIVE_LABELS[event.cognitive_type] ?? event.cognitive_type}
        </span>
      </div>
      <EventHorizon event={event} onBegin={onBegin} />
    </div>
  );
}

export function CalendarWidget({ onBeginSession }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const { events } = useDigest();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const pillLabel = `${format(today, 'EEE')} ${format(today, 'd')}`;

  const handleBegin = (event: CadenceEvent) => {
    onBeginSession(event);
    setExpanded(false);
  };

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.pill}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <CalendarIcon />
        <span>{pillLabel}</span>
      </button>

      {expanded && (
        <div className={styles.panel}>
          {/* Week strip */}
          <div className={styles.weekStrip}>
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`${styles.weekDay} ${isToday(day) ? styles.weekDayActive : ''}`}
              >
                <span className={styles.weekDayName}>{format(day, 'EEEEE')}</span>
                <span className={styles.weekDayNum}>{format(day, 'd')}</span>
              </div>
            ))}
          </div>

          {/* Event list */}
          <div className={styles.eventList}>
            {events.length === 0 ? (
              <div className={styles.empty}>Nothing above threshold</div>
            ) : (
              events.map((event) => (
                <EventRow key={event.id} event={event} onBegin={handleBegin} />
              ))
            )}
          </div>

          {/* Ask anything */}
          <div className={styles.askRow}>
            <input
              className={styles.askInput}
              placeholder="Ask anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2.5" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5H13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.5 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
