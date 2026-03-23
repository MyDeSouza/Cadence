import { useEffect } from 'react';
import { CalendarWidget } from './components/CalendarWidget';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { StatusBar } from './components/StatusBar';
import { useSession } from './hooks/useSession';
import type { CadenceEvent } from './types';
import styles from './App.module.css';

const API_BASE = 'http://localhost:3001';

export default function App() {
  const { session, beginSession, endSession } = useSession();

  // Trigger background sync on mount
  useEffect(() => {
    fetch(`${API_BASE}/sync/google`).catch(() => {});
  }, []);

  const handleBeginSession = (event: CadenceEvent) => {
    beginSession(event);
  };

  return (
    <div className={styles.workspace}>
      <CalendarWidget onBeginSession={handleBeginSession} />
      <FovealCanvas session={session} onEndSession={endSession} />
      <StatusBar session={session} />
      <AgentWidget />
    </div>
  );
}
