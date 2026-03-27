import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useDigest } from '../../hooks/useDigest';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import type { CadenceEvent } from '../../types';
import styles from './EventStrip.module.css';

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="white" strokeWidth="1.5" />
      <path
        d="M3 17c0-3.866 3.134-7 7-7s7 3.134 7 7"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isActive(event: CadenceEvent, now: Date): boolean {
  const start = new Date(event.timestamp);
  const end = event.deadline
    ? new Date(event.deadline)
    : new Date(start.getTime() + 3_600_000);
  return start <= now && now <= end;
}

function getPillEvent(events: CadenceEvent[], now: Date): CadenceEvent | null {
  const active = events.find((e) => isActive(e, now));
  if (active) return active;
  return events.find((e) => new Date(e.timestamp) > now) ?? null;
}

function fmtTimeRange(event: CadenceEvent): string {
  const start = parseISO(event.timestamp);
  const startStr = format(start, 'h:mm');
  if (!event.deadline) return format(start, 'h:mm') + format(start, 'aaa');
  const end = parseISO(event.deadline);
  return `${startStr} – ${format(end, 'h:mm') + format(end, 'aaa')}`;
}

function fmtDuration(event: CadenceEvent): string {
  if (!event.deadline) return '';
  const totalMin = Math.round(
    (new Date(event.deadline).getTime() - new Date(event.timestamp).getTime()) / 60_000
  );
  if (totalMin < 60) return `${totalMin}min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) return `${hrs}hr${hrs > 1 ? 's' : ''}`;
  return `${hrs}hr ${mins}min`;
}

interface Props {
  theme: Theme;
  onToggle: () => void;
}

export function EventStrip({ theme, onToggle }: Props) {
  const [now, setNow] = useState(() => new Date());
  const { events } = useDigest();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const event = getPillEvent(events, now);
  const subtitle = event?.raw_content || event?.location || '';
  const duration = event ? fmtDuration(event) : '';

  return (
    <div className={styles.strip}>
      <button
        className={`${styles.mark} ${styles[`mark_${theme}`]}`}
        onClick={onToggle}
        aria-label="Toggle calendar"
      >
        <PersonIcon />
      </button>

      {event && (
        <div className={styles.info}>
          <div className={styles.row1}>
            <span className={`${styles.title} ${styles[`title_${theme}`]}`}>
              {event.title}
            </span>
            <span className={`${styles.timeRange} ${styles[`timeRange_${theme}`]}`}>
              {fmtTimeRange(event)}
            </span>
          </div>
          {(subtitle || duration) && (
            <div className={styles.row2}>
              <span className={`${styles.subtitle} ${styles[`subtitle_${theme}`]}`}>
                {subtitle}
              </span>
              {duration && (
                <span className={`${styles.duration} ${styles[`duration_${theme}`]}`}>
                  {duration}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
