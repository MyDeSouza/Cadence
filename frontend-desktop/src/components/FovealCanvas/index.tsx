import type { ActiveSession } from '../../types';
import styles from './FovealCanvas.module.css';

interface Props {
  session: ActiveSession | null;
  onEndSession: () => void;
}

export function FovealCanvas(_props: Props) {
  return <div className={styles.canvas} />;
}
