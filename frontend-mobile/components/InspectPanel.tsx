import { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { CadenceEvent } from '../types';
import { COGNITIVE_COLOURS, COGNITIVE_DESCRIPTIONS } from '../constants/colours';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sourceWeight(source: string): number {
  const weights: Record<string, number> = {
    google_calendar: 70,
    gmail: 60,
    manual: 90,
    webhook: 30,
    apple_calendar: 70,
  };
  return weights[source] ?? 50;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  event: CadenceEvent;
  onClose: () => void;
}

export function InspectPanel({ event, onClose }: Props) {
  const translateY = useSharedValue(400);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = () => {
    translateY.value = withSpring(400, { damping: 22 });
    setTimeout(onClose, 280);
  };

  const sw = sourceWeight(event.source);
  const hasDeadline = !!event.deadline;
  const cogColor = COGNITIVE_COLOURS[event.cognitive_type] ?? '#B8BEC6';
  const description = COGNITIVE_DESCRIPTIONS[event.cognitive_type] ?? '';

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View style={[styles.sheet, animStyle]}>
        {/* Score */}
        <Text style={styles.score}>{Math.round(event.score)}</Text>
        <Text style={styles.scoreLabel}>Priority Score</Text>

        {/* Breakdown */}
        <View style={styles.breakdown}>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Source weight</Text>
            <Text style={styles.rowVal}>{sw}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Cognitive type</Text>
            <Text style={[styles.rowVal, { color: cogColor }]}>
              {event.cognitive_type.replace('_', ' ')}
            </Text>
          </View>
          {hasDeadline && (
            <View style={styles.row}>
              <Text style={styles.rowKey}>Has deadline</Text>
              <Text style={styles.rowVal}>×1.8</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* Dismiss */}
        <Pressable style={styles.gotItBtn} onPress={handleClose}>
          <Text style={styles.gotItText}>Got it</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: 'rgba(15,15,15,0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
  },
  score: {
    fontSize: 48,
    fontFamily: 'Outfit_600SemiBold',
    color: 'white',
    lineHeight: 56,
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  breakdown: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowKey: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.5)',
  },
  rowVal: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  description: {
    fontSize: 12,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  gotItBtn: {
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 24,
  },
  gotItText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: '#0A0A0A',
  },
});
