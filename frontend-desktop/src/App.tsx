import { useCallback, useRef, useState } from 'react';
import { CalendarWidget } from './components/CalendarWidget';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { EventStrip } from './components/EventStrip';
import { DateDisplay } from './components/DateDisplay';
import { useSession } from './hooks/useSession';
import { useAdaptiveTheme } from './hooks/useAdaptiveTheme';
import { useDigest } from './hooks/useDigest';
import type { CadenceEvent } from './types';
import styles from './App.module.css';

export default function App() {
  const { session, beginSession, endSession } = useSession();
  const theme = useAdaptiveTheme();
  const { events, refetch: refetchEvents } = useDigest();

  const syncAndRefetch = useCallback(() => { refetchEvents(); }, [refetchEvents]);
  const [calendarOpen, setCalendarOpen] = useState(true);

  const [bgPos,      setBgPos]      = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);


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
      {/* Cloud blobs — day theme only */}
      {theme === 'day' && <>
        <div style={{ position:'absolute', width:430, height:430, left:-5,   top:20,  borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:340, height:250, left:80,   top:80,  borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:340, height:220, left:80,   top:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:430, height:430, left:175,  top:60,  borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:240, left:430,  top:110, borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:240, left:430,  top:260, borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:430, height:430, left:794,  top:15,  borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:240, left:1058, top:55,  borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:240, left:1058, top:214, borderRadius:'50%', background:'radial-gradient(circle, rgba(180,200,230,0.55) 0%, rgba(180,200,230,0) 70%)', filter:'blur(28px)', pointerEvents:'none' }} />
        {/* Vignette */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', boxShadow:'inset 0 0 69px 12px rgba(0,0,0,0.08)' }} />
      </>}
      <EventStrip theme={theme} onToggle={() => setCalendarOpen((v) => !v)} />
      <DateDisplay theme={theme} onToggle={() => setCalendarOpen((v) => !v)} />
      {calendarOpen && (
        <CalendarWidget
          theme={theme}
          events={events}
          onClose={() => setCalendarOpen(false)}
          onBeginSession={handleBeginSession}
        />
      )}
      <FovealCanvas session={session} onEndSession={handleEndSession} theme={theme} />
      <AgentWidget theme={theme} events={events} onActionApplied={syncAndRefetch} />
    </div>
  );
}
