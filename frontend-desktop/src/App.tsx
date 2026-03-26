import { useEffect, useRef, useState } from 'react';
import { CalendarWidget } from './components/CalendarWidget';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { StatusBar } from './components/StatusBar';
import { useSession } from './hooks/useSession';
import type { CadenceEvent } from './types';
import styles from './App.module.css';
import { API_BASE } from './constants/api';

export default function App() {
  const { session, beginSession, endSession } = useSession();

  const [bgPos,      setBgPos]      = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Trigger background sync on mount
  useEffect(() => {
    fetch(`${API_BASE}/sync/google`).catch(() => {});
  }, []);

  const handleBeginSession = (event: CadenceEvent) => {
    beginSession(event);
  };

  const handleEndSession = () => {
    endSession();
    setBgPos({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag when clicking directly on the workspace background
    if (e.target !== e.currentTarget) return;
    dragRef.current = {
      startX:  e.clientX,
      startY:  e.clientY,
      originX: bgPos.x,
      originY: bgPos.y,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setBgPos({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  };

  const handleMouseUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <div
      className={styles.workspace}
      style={{
        backgroundPosition: `${bgPos.x}px ${bgPos.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <CalendarWidget onBeginSession={handleBeginSession} />
      <FovealCanvas session={session} onEndSession={handleEndSession} />
      <StatusBar session={session} />
      <AgentWidget />
    </div>
  );
}
