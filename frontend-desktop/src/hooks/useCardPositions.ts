import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cadence-card-positions';

export type Pos = { x: number; y: number };
type PosMap = Record<string, Pos>;

/** Default grid position for a card that has never been moved */
function defaultPos(index: number): Pos {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 160 + col * (332 + 36),
    y: 260 + row * (201 + 24),
  };
}

function loadFromStorage(): PosMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function useCardPositions() {
  const [positions, setPositions] = useState<PosMap>(loadFromStorage);

  /** Realtime update during drag — does NOT write to localStorage */
  const moveCard = useCallback((url: string, pos: Pos) => {
    setPositions((prev) => ({ ...prev, [url]: pos }));
  }, []);

  /** Called on drag end — commits position to localStorage */
  const dropCard = useCallback((url: string, pos: Pos) => {
    setPositions((prev) => {
      const next = { ...prev, [url]: pos };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* storage quota */ }
      return next;
    });
  }, []);

  const getPos = useCallback(
    (url: string, index: number): Pos => positions[url] ?? defaultPos(index),
    [positions],
  );

  return { getPos, moveCard, dropCard };
}