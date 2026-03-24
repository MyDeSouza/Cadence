import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import type { GradientPeriod } from '../constants/gradients';
import type { CadenceEvent } from '../types';

// ─── Weather ──────────────────────────────────────────────────────────────────

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌦',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '🌨',
  80: '🌦', 81: '🌦', 82: '🌦',
  95: '⛈', 96: '⛈', 99: '⛈',
};

interface WeatherState {
  temp: number;
  icon: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingText(period: GradientPeriod, firstName?: string): string {
  const n = firstName ? ` ${firstName}` : '';
  switch (period) {
    case 'morning':   return `Good Morning${n}`;
    case 'afternoon': return `Good Afternoon${n}`;
    case 'evening':   return `Good Evening${n}`;
    case 'night':     return firstName ? `Still up, ${firstName}?` : 'Still up?';
  }
}

function subtitleText(count: number): string {
  if (count === 0) return 'Nothing urgent right now.';
  if (count === 1) return 'One thing needs your attention.';
  if (count <= 3) return `${count} things on your radar today.`;
  return 'Your focus window is full.';
}

function nextCountdownText(allEvents: CadenceEvent[]): string {
  const now = new Date();
  const active = allEvents.find((e) => {
    const s = new Date(e.timestamp);
    const end = e.deadline
      ? new Date(e.deadline)
      : new Date(s.getTime() + 3_600_000);
    return s <= now && now <= end;
  });
  if (active) return 'now';

  const upcoming = [...allEvents]
    .filter((e) => new Date(e.timestamp) > now)
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  if (upcoming.length === 0) return '—';
  const ms = new Date(upcoming[0].timestamp).getTime() - now.getTime();
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `in ${h}h`;
  return `in ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  period: GradientPeriod;
  signals: CadenceEvent[];
  allEvents: CadenceEvent[];
}

export function TopSection({ period, signals, allEvents }: Props) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [countdown, setCountdown] = useState(() => nextCountdownText(allEvents));

  // Update countdown every minute
  useEffect(() => {
    setCountdown(nextCountdownText(allEvents));
    const id = setInterval(() => setCountdown(nextCountdownText(allEvents)), 60_000);
    return () => clearInterval(id);
  }, [allEvents]);

  // Fetch weather once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const data = await res.json();
      const temp = Math.round(data.current_weather.temperature);
      const code: number = data.current_weather.weathercode;
      setWeather({ temp, icon: WMO_ICONS[code] ?? '🌡' });
    })().catch(() => {});
  }, []);

  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const day = String(now.getDate()).padStart(2, '0');

  return (
    <View style={styles.container}>
      {/* Cadence cross mark — two intersecting bars */}
      <View style={styles.mark}>
        <View style={styles.markV} />
        <View style={styles.markH} />
      </View>

      {/* Context pills */}
      <View style={styles.pillsRow}>
        {/* Weather */}
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {weather ? `${weather.icon} ${weather.temp}°` : '○'}
          </Text>
        </View>

        {/* Date */}
        <View style={styles.pill}>
          <Text style={styles.pillText}>{month} </Text>
          <View style={styles.dayHighlight}>
            <Text style={styles.pillText}>{day}</Text>
          </View>
        </View>

        {/* Next event countdown */}
        <View style={styles.pill}>
          <Text style={styles.pillText}>{countdown}</Text>
        </View>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>{greetingText(period)}</Text>
      <Text style={styles.subtitle}>{subtitleText(signals.length)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mark: {
    width: 16,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  markV: {
    position: 'absolute',
    width: 1.5,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  markH: {
    position: 'absolute',
    width: 16,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pillText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Outfit_300Light',
  },
  dayHighlight: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  greeting: {
    fontSize: 32,
    fontFamily: 'Outfit_400Regular',
    color: 'white',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.7)',
    alignSelf: 'flex-start',
  },
});
