import { useState, useEffect } from 'react';
import type { CadenceEvent } from '../types';
import { differenceInMinutes, parseISO } from 'date-fns';

const HORIZON_MINUTES = 30;

export interface HorizonStatus {
  isApproaching: boolean;
  minutesUntil: number;
}

export function useEventHorizon(event: CadenceEvent): HorizonStatus {
  const [minutesUntil, setMinutesUntil] = useState<number>(() => {
    const ts = parseISO(event.timestamp);
    return differenceInMinutes(ts, new Date());
  });

  useEffect(() => {
    const update = () => {
      const ts = parseISO(event.timestamp);
      const diff = differenceInMinutes(ts, new Date());
      setMinutesUntil(diff);
    };

    update();
    const interval = setInterval(update, 30_000); // every 30 seconds
    return () => clearInterval(interval);
  }, [event.timestamp]);

  return {
    isApproaching: minutesUntil >= 0 && minutesUntil <= HORIZON_MINUTES,
    minutesUntil,
  };
}
