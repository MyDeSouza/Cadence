import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import styles from './DateDisplay.module.css';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

export function DateDisplay({ theme, onToggle }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const monthText = format(now, 'MMM') + '.';
  const dayText = format(now, 'd');

  return (
    <button
      className={styles.wrapper}
      onClick={onToggle}
      aria-label="Toggle calendar"
    >
      <span className={`${styles.month} ${styles[`month_${theme}`]}`}>
        {monthText}
      </span>
      <span className={`${styles.day} ${styles[`day_${theme}`]}`}>
        {dayText}
      </span>
    </button>
  );
}
