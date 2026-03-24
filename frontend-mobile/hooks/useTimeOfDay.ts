import { useState, useEffect } from 'react';
import type { GradientPeriod } from '../constants/gradients';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../constants/gradients';

export function getPeriod(hour: number): GradientPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function useTimeOfDay() {
  const [period, setPeriod] = useState<GradientPeriod>(() =>
    getPeriod(new Date().getHours())
  );

  useEffect(() => {
    const check = () => setPeriod(getPeriod(new Date().getHours()));
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  return {
    period,
    colors: GRADIENT_COLORS[period],
    locations: GRADIENT_LOCATIONS[period],
  };
}
