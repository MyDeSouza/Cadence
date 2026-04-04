import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import logoSrc from '../../assets/Logo.svg';
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
  const dayText   = format(now, 'd');

  return (
    <button
      className={styles.notch}
      onClick={onToggle}
      aria-label="Toggle calendar"
    >
      {/* Backing strip — seals the left screen edge */}
      <div className={styles.backingStrip} />

      {/* Top cap — concave transition */}
      <div className={`${styles.cap} ${styles.capTop} ${styles[`capTop_${theme}`]}`} />

      {/* Body pill */}
      <div className={styles.body}>
        {/* App icon */}
        <div className={styles.iconWrap}>
          <img src={logoSrc} alt="Cadence" className={styles.iconImg} />
        </div>

        {/* Date widget */}
        <div className={styles.dateWidget}>
          <span className={styles.month}>{monthText}</span>
          <div className={styles.dayPill}>
            <span className={styles.day}>{dayText}</span>
          </div>
        </div>
      </div>

      {/* Bottom cap */}
      <div className={`${styles.cap} ${styles.capBottom} ${styles[`capBottom_${theme}`]}`} />
    </button>
  );
}
