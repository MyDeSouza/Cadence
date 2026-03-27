import { useEffect, useRef, useState } from 'react';
import { CalendarWidget } from './components/CalendarWidget';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { EventStrip } from './components/EventStrip';
import { DateDisplay } from './components/DateDisplay';
import { useSession } from './hooks/useSession';
import { useAdaptiveTheme } from './hooks/useAdaptiveTheme';
import type { CadenceEvent } from './types';
import styles from './App.module.css';
import { API_BASE } from './constants/api';

export default function App() {
  const { session, beginSession, endSession } = useSession();
  const theme = useAdaptiveTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [bgPos,      setBgPos]      = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

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
      className={`${styles.workspace} ${styles[`workspace_${theme}`]}`}
      style={{
        backgroundPosition: `${bgPos.x}px ${bgPos.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <EventStrip theme={theme} onToggle={() => setCalendarOpen((v) => !v)} />
      <DateDisplay theme={theme} onToggle={() => setCalendarOpen((v) => !v)} />
      {calendarOpen && (
        <CalendarWidget
          theme={theme}
          onClose={() => setCalendarOpen(false)}
          onBeginSession={handleBeginSession}
        />
      )}
      <FovealCanvas session={session} onEndSession={handleEndSession} />
      <AgentWidget theme={theme} />
    </div>
  );
}
