import type { CadenceEvent } from '../../types';
import { useEventHorizon } from '../../hooks/useEventHorizon';
import styles from './EventHorizon.module.css';

interface Props {
  event: CadenceEvent;
  onBegin: (event: CadenceEvent) => void;
}

export function EventHorizon({ event, onBegin }: Props) {
  const { isApproaching, minutesUntil } = useEventHorizon(event);

  if (!isApproaching) return null;

  return (
    <div className={styles.horizon}>
      <span className={styles.countdown}>
        {minutesUntil <= 0 ? 'now' : `${minutesUntil} min`}
      </span>
      <button className={styles.begin} onClick={() => onBegin(event)}>
        → Begin
      </button>
    </div>
  );
}
