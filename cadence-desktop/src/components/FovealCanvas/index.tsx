import type { ActiveSession } from '../../types';
import { differenceInSeconds } from 'date-fns';
import { useState, useEffect } from 'react';
import styles from './FovealCanvas.module.css';

interface Props {
  session: ActiveSession | null;
  onEndSession: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FovealCanvas({ session, onEndSession }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(differenceInSeconds(new Date(), session.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  return (
    <div className={styles.canvas}>
      <div className={styles.watermark}>{session.event.title}</div>

      <div className={styles.timer}>
        <span className={styles.timerLabel}>{formatElapsed(elapsed)}</span>
        <button className={styles.endBtn} onClick={onEndSession}>
          End
        </button>
      </div>
    </div>
  );
}
