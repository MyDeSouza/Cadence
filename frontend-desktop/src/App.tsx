import { useCallback, useRef, useState } from 'react';
import { CalendarWidget } from './components/CalendarWidget';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { EventStrip } from './components/EventStrip';
import { DateDisplay } from './components/DateDisplay';
import { DraftingTable } from './components/DraftingTable';
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
  const [calendarOpen,  setCalendarOpen]  = useState(true);
  const [draftingOpen,  setDraftingOpen]  = useState(false);

  const [bgPos,      setBgPos]      = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleBeginSession = (event: CadenceEvent) => { beginSession(event); };
  const handleEndSession   = () => { endSession(); setBgPos({ x: 0, y: 0 }); };

  const [resetLayoutKey, setResetLayoutKey] = useState(0);

  const handleRecenter = useCallback(() => {
    setBgPos({ x: 0, y: 0 });
    setResetLayoutKey((k) => k + 1);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: bgPos.x, originY: bgPos.y };
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
    <>
      {/* ── Fixed sky backdrop (day only) ───────────────────── */}
      {theme === 'day' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #485e80 0%, #cadaf6 100%)' }} />

          <div className={`${styles.cloud} ${styles.cloud1}`} style={{ width: 430, height: 430, left: -5,   top: 20  }} />
          <div className={`${styles.cloud} ${styles.cloud2}`} style={{ width: 340, height: 250, left: 80,   top: 80  }} />
          <div className={`${styles.cloud} ${styles.cloud3}`} style={{ width: 340, height: 220, left: 80,   top: 200 }} />
          <div className={`${styles.cloud} ${styles.cloud4}`} style={{ width: 430, height: 430, left: 175,  top: 60  }} />
          <div className={`${styles.cloud} ${styles.cloud5}`} style={{ width: 280, height: 240, left: 430,  top: 110 }} />
          <div className={`${styles.cloud} ${styles.cloud6}`} style={{ width: 280, height: 240, left: 430,  top: 260 }} />
          <div className={`${styles.cloud} ${styles.cloud7}`} style={{ width: 430, height: 430, left: 794,  top: 15  }} />
          <div className={`${styles.cloud} ${styles.cloud8}`} style={{ width: 280, height: 240, left: 1058, top: 55  }} />
          <div className={`${styles.cloud} ${styles.cloud9}`} style={{ width: 280, height: 240, left: 1058, top: 214 }} />

          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 69px 12px rgba(0,0,0,0.08)' }} />
        </div>
      )}

      {/* ── Draggable workspace (dot-grid canvas) ───────────── */}
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
        <EventStrip theme={theme} />
        <DateDisplay
          theme={theme}
          onToggle={() => setCalendarOpen((v) => !v)}
          onRecenter={handleRecenter}
          onDraftToggle={() => setDraftingOpen((v) => !v)}
          draftOpen={draftingOpen}
        />
        {draftingOpen && (
          <DraftingTable
            theme={theme}
            onClose={() => setDraftingOpen(false)}
          />
        )}
        {calendarOpen && (
          <CalendarWidget
            theme={theme}
            events={events}
            onClose={() => setCalendarOpen(false)}
            onBeginSession={handleBeginSession}
          />
        )}
        <FovealCanvas
          session={session}
          onEndSession={handleEndSession}
          theme={theme}
          resetLayoutKey={resetLayoutKey}
        />
        <AgentWidget theme={theme} events={events} onActionApplied={syncAndRefetch} />
      </div>
    </>
  );
}