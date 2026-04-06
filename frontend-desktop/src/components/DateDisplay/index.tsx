import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import type { CadenceEvent } from '../../types';
import { CalendarWidget } from '../CalendarWidget';
import styles from './DateDisplay.module.css';

interface Props {
  theme:          Theme;
  events:         CadenceEvent[];
  onBeginSession: (event: CadenceEvent) => void;
}

function AccountsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7"  cy="6.5" r="2.5" stroke="white" strokeWidth="1.4" strokeOpacity="0.6" />
      <path   d="M2 16c0-2.761 2.239-5 5-5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
      <circle cx="13" cy="6.5" r="2.5" stroke="white" strokeWidth="1.4" strokeOpacity="0.6" />
      <path   d="M10 16c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="white" strokeWidth="1.4" strokeOpacity="0.6" />
      <path   d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

export function DateDisplay({ theme, events, onBeginSession }: Props) {
  const [now,          setNow]          = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const notchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (notchRef.current && !notchRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  const monthText = format(now, 'MMM') + '.';
  const dayText   = format(now, 'd');

  return (
    <div ref={notchRef} className={styles.notch}>
      {/* Month label */}
      <span className={styles.month}>{monthText}</span>

      {/* Date circle — click to toggle calendar */}
      <button
        className={styles.dayCircleBtn}
        onClick={() => setCalendarOpen((v) => !v)}
        aria-label="Toggle calendar"
        aria-expanded={calendarOpen}
      >
        <span className={styles.day}>{dayText}</span>
      </button>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Accounts icon */}
      <button className={styles.iconBtn} aria-label="Accounts">
        <AccountsIcon />
      </button>

      {/* Single user icon */}
      <button className={`${styles.iconBtn} ${styles.iconBtnGap}`} aria-label="User profile">
        <UserIcon />
      </button>

      {/* Floating calendar panel — slides out to the right */}
      {calendarOpen && (
        <div className={styles.calendarSlide}>
          <CalendarWidget
            theme={theme}
            events={events}
            onClose={() => setCalendarOpen(false)}
            onBeginSession={onBeginSession}
          />
        </div>
      )}
    </div>
  );
}
