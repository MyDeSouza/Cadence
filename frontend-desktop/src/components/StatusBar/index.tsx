import { useEffect, useState } from 'react';
import type { ActiveSession } from '../../types';
import { useSurfaced } from '../../hooks/useSurfaced';
import { differenceInMinutes } from 'date-fns';
import styles from './StatusBar.module.css';

interface Props {
  session: ActiveSession | null;
}

export function StatusBar({ session }: Props) {
  const surfacedCount = useSurfaced();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getStatus = () => {
    if (session) {
      const elapsed = differenceInMinutes(new Date(), session.startedAt);
      return { dot: styles.dotActive, label: `Session active — ${elapsed} min` };
    }
    if (surfacedCount > 0) {
      return { dot: styles.dotSignal, label: `${surfacedCount} signal${surfacedCount !== 1 ? 's' : ''}` };
    }
    return { dot: styles.dotClear, label: 'Clear' };
  };

  const { dot, label } = getStatus();

  return (
    <div className={styles.bar}>
      <span className={styles.time}>{formatTime(time)}</span>
      <span className={styles.divider} />
      <span className={`${styles.dot} ${dot}`} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
