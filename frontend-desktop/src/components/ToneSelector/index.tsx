import { useState, useRef, useCallback } from 'react';
import type { TonePosition } from '../../types';
import styles from './ToneSelector.module.css';

const TONE_LABELS: TonePosition['label'][] = [
  'Formal',
  'Professional',
  'Neutral',
  'Casual',
  'Direct',
];

interface Props {
  value: TonePosition;
  onChange: (v: TonePosition) => void;
}

export function ToneSelector({ value, onChange }: Props) {
  const sliderIndex = TONE_LABELS.indexOf(value.label);
  const quadrantRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleSlider = (idx: number) => {
    onChange({ ...value, label: TONE_LABELS[idx] });
  };

  const posFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = quadrantRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    const pos = posFromEvent(e.clientX, e.clientY);
    if (pos) onChange({ ...value, ...pos });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = posFromEvent(e.clientX, e.clientY);
    if (pos) onChange({ ...value, ...pos });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div className={styles.wrapper}>
      {/* Horizontal tone slider */}
      <div className={styles.sliderRow}>
        {TONE_LABELS.map((label, i) => (
          <button
            key={label}
            className={`${styles.toneOption} ${i === sliderIndex ? styles.toneActive : ''}`}
            onClick={() => handleSlider(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.sliderTrack}>
        <div
          className={styles.sliderThumb}
          style={{ left: `${(sliderIndex / (TONE_LABELS.length - 1)) * 100}%` }}
        />
      </div>

      {/* 2-axis quadrant */}
      <div
        ref={quadrantRef}
        className={styles.quadrant}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <span className={`${styles.axisLabel} ${styles.top}`}>Clinical</span>
        <span className={`${styles.axisLabel} ${styles.bottom}`}>Warm</span>
        <span className={`${styles.axisLabel} ${styles.left}`}>Concise</span>
        <span className={`${styles.axisLabel} ${styles.right}`}>Detailed</span>
        <div
          className={styles.quadrantDot}
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        />
      </div>
    </div>
  );
}
