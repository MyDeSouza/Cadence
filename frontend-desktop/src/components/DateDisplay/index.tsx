import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import logoSrc from '../../assets/Logo.svg';
import styles from './DateDisplay.module.css';

interface Props {
  theme:      Theme;
  onToggle:   () => void;
  onRecenter: () => void;
}

function RecenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="7" y1="1"  x2="7" y2="4.5"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="9.5" x2="7" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1"  y1="7" x2="4.5" y2="7"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="7" x2="13" y2="7"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="7" r="1.75" fill="white" />
    </svg>
  );
}

export function DateDisplay({ theme, onToggle, onRecenter }: Props) {
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

        {/* Recenter button */}
        <button
          className={styles.recenterBtn}
          onClick={(e) => { e.stopPropagation(); onRecenter(); }}
          aria-label="Recenter canvas"
          title="Reset card layout"
        >
          <RecenterIcon />
        </button>

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
