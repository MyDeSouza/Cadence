import { View, Text, StyleSheet } from 'react-native';
import type { CadenceEvent } from '../types';
import { COGNITIVE_COLOURS, COGNITIVE_LABELS, SOURCE_LABELS } from '../constants/colours';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTimeRange(event: CadenceEvent): string {
  const start = new Date(event.timestamp);
  if (!event.deadline) return fmt12(start);
  const end = new Date(event.deadline);
  return `${fmt12(start)} – ${fmt12(end)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  event: CadenceEvent;
}

export function SignalCard({ event }: Props) {
  const cogColor = COGNITIVE_COLOURS[event.cognitive_type] ?? '#B8BEC6';
  const cogLabel = COGNITIVE_LABELS[event.cognitive_type] ?? 'Info';
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;
  const scoreRatio = Math.min(1, Math.max(0, event.score / 100));

  return (
    <View style={styles.card}>
      {/* Header: cognitive badge + source badge */}
      <View style={styles.headerRow}>
        <View style={styles.cogBadge}>
          <View style={[styles.cogDot, { backgroundColor: cogColor }]} />
          <Text style={styles.cogLabel}>{cogLabel}</Text>
        </View>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceLabel}>{sourceLabel}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={3}>
        {event.title}
      </Text>

      {/* Time */}
      <Text style={styles.time}>{formatTimeRange(event)}</Text>

      {/* Location — only if present */}
      {event.location ? (
        <Text style={styles.location} numberOfLines={1}>
          📍 {event.location}
        </Text>
      ) : null}

      {/* Score bar */}
      <View style={styles.scoreTrack}>
        <View
          style={[
            styles.scoreFill,
            {
              width: `${scoreRatio * 100}%`,
              backgroundColor: cogColor + '66', // 40% opacity
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 64,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 32,
    minHeight: 210,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cogDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cogLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    color: '#888888',
  },
  sourceBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sourceLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_400Regular',
    color: '#888888',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Outfit_600SemiBold',
    color: '#0A0A0A',
    lineHeight: 31,
    marginBottom: 10,
  },
  time: {
    fontSize: 14,
    fontFamily: 'Outfit_300Light',
    color: '#888888',
    marginBottom: 6,
  },
  location: {
    fontSize: 12,
    fontFamily: 'Outfit_300Light',
    color: '#AAAAAA',
    marginBottom: 4,
  },
  scoreTrack: {
    marginTop: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  scoreFill: {
    height: 3,
    borderRadius: 2,
  },
});
