import { useState, useEffect } from 'react';

export type Theme = 'day' | 'night';

export function useAdaptiveTheme(): Theme {
  const getTheme = (): Theme => {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? 'day' : 'night';
  };
  const [theme, setTheme] = useState<Theme>(getTheme());
  useEffect(() => {
    const interval = setInterval(() => setTheme(getTheme()), 60_000);
    return () => clearInterval(interval);
  }, []);
  return theme;
}
