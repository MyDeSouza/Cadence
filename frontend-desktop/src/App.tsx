import { useCallback, useRef, useState } from 'react';
import { AgentWidget } from './components/AgentWidget';
import { FovealCanvas } from './components/FovealCanvas';
import { EventStrip } from './components/EventStrip';
import { DateDisplay } from './components/DateDisplay';
import { useSession } from './hooks/useSession';
import { useAdaptiveTheme } from './hooks/useAdaptiveTheme';
import type { CanvasCommand, CanvasFilterState } from './utils/canvasCommands';
import { INITIAL_CANVAS_FILTER } from './utils/canvasCommands';
import type { VisibleCard } from './components/FovealCanvas';
import styles from './App.module.css';

export default function App() {
  const { session, endSession } = useSession();
  const theme = useAdaptiveTheme();

  const [bgPos,         setBgPos]         = useState({ x: 0, y: 0 });
  const [isDragging,    setIsDragging]    = useState(false);
  const [canvasFilter,  setCanvasFilter]  = useState<CanvasFilterState>(INITIAL_CANVAS_FILTER);
  const [visibleCards,  setVisibleCards]  = useState<VisibleCard[]>([]);
  const [ytQuery,       setYtQuery]       = useState<string | undefined>(undefined);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleEndSession = () => { endSession(); setBgPos({ x: 0, y: 0 }); };

  const handleCanvasCommand = useCallback((cmd: CanvasCommand) => {
    switch (cmd.kind) {
      case 'filterType':
        setCanvasFilter(prev => ({ ...prev, fileType: cmd.fileType }));
        break;
      case 'resetFilter':
        setCanvasFilter(INITIAL_CANVAS_FILTER);
        break;
      case 'hideSource':
        setCanvasFilter(prev => {
          const s = new Set(prev.hiddenSources); s.add(cmd.source);
          return { ...prev, hiddenSources: s };
        });
        break;
      case 'showSource':
        setCanvasFilter(prev => {
          const s = new Set(prev.hiddenSources); s.delete(cmd.source);
          return { ...prev, hiddenSources: s };
        });
        break;
      case 'sortRecent':
        setCanvasFilter(prev => ({ ...prev, sortByRecent: true }));
        break;
      case 'highlightTitle':
        setCanvasFilter(prev => ({ ...prev, titleKeyword: cmd.keyword }));
        break;
      case 'calendarDay':
        window.dispatchEvent(new CustomEvent('cadenceCalendarDay', { detail: { date: cmd.date } }));
        break;
      case 'nextEvent':
        // Handled entirely in AgentWidget (fetches events, shows in bubble)
        break;
      case 'youtubeSearch':
        setYtQuery(cmd.query);
        break;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: bgPos.x, originY: bgPos.y };
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setBgPos({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
  }, []);

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

      {/* ── Draggable workspace ──────────────────────────────── */}
      <div
        className={`${styles.workspace} ${styles[`workspace_${theme}`]}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid */}
        <div
          className={`${styles.dotGrid} ${styles[`dotGrid_${theme}`]}`}
          style={{ backgroundPosition: `${bgPos.x}px ${bgPos.y}px` }}
        />

        <EventStrip theme={theme} />

        <DateDisplay />

        <FovealCanvas
          session={session}
          onEndSession={handleEndSession}
          theme={theme}
          bgPos={bgPos}
          canvasFilter={canvasFilter}
          youtubeQuery={ytQuery}
          onVisibleCardsChange={setVisibleCards}
        />

        <AgentWidget
          onDraftGenerated={() => {}}
          onCanvasCommand={handleCanvasCommand}
          visibleCards={visibleCards}
        />
      </div>
    </>
  );
}
