import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CadenceEvent } from '../types';
import { SignalCard } from './SignalCard';
import { DetailView } from './DetailView';
import { InspectPanel } from './InspectPanel';
import { API_BASE } from '../constants/api';

const { width: SW, height: SH } = Dimensions.get('window');

const MAX_SIGNALS = 4;

async function postFeedback(
  id: string,
  outcome: 'actioned' | 'dismissed' | 'ignored'
) {
  try {
    await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cadence_event_id: id, outcome }),
    });
  } catch {
    // silent — feedback must not block UX
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  signals: CadenceEvent[];
  onFlashGreen: () => void;
  hintsVisible: boolean;
  onInteraction: () => void;
}

// ─── CardStack ────────────────────────────────────────────────────────────────

export function CardStack({
  signals,
  onFlashGreen,
  hintsVisible,
  onInteraction,
}: Props) {
  const [queue, setQueue] = useState<CadenceEvent[]>(
    signals.slice(0, MAX_SIGNALS)
  );
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const [detailEvent, setDetailEvent] = useState<CadenceEvent | null>(null);
  const [inspectEvent, setInspectEvent] = useState<CadenceEvent | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Merge new signals from API refresh into the queue
  useEffect(() => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const incoming = signals.filter((e) => !existingIds.has(e.id));
      return [...prev, ...incoming].slice(0, MAX_SIGNALS);
    });
  }, [signals]);

  // Reset animation when the top card changes
  const topId = queue[0]?.id;
  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [topId]);

  // ── Swipe handlers (JS thread) ────────────────────────────────────────────

  const doSwipeRight = useCallback(() => {
    const card = queueRef.current[0];
    if (!card) return;
    onInteraction();
    onFlashGreen();
    setTimeout(() => {
      postFeedback(card.id, 'actioned');
      setQueue((prev) => prev.filter((e) => e.id !== card.id));
    }, 320);
  }, [onInteraction, onFlashGreen]);

  const doSwipeLeft = useCallback(() => {
    const card = queueRef.current[0];
    if (!card) return;
    onInteraction();
    setTimeout(() => {
      postFeedback(card.id, 'dismissed');
      setQueue((prev) => prev.filter((e) => e.id !== card.id));
    }, 320);
  }, [onInteraction]);

  const doSwipeUp = useCallback(() => {
    const card = queueRef.current[0];
    if (!card) return;
    onInteraction();
    setTimeout(() => {
      postFeedback(card.id, 'ignored');
      // Move to back
      setQueue((prev) => {
        const rest = prev.filter((e) => e.id !== card.id);
        return [...rest, card];
      });
    }, 320);
  }, [onInteraction]);

  const doTap = useCallback(() => {
    const card = queueRef.current[0];
    if (card) setDetailEvent(card);
  }, []);

  const doLongPress = useCallback(() => {
    const card = queueRef.current[0];
    if (card) setInspectEvent(card);
  }, []);

  // ── Gestures ──────────────────────────────────────────────────────────────

  const pan = Gesture.Pan()
    .minDistance(10)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const DIST = 90;
      const VEL = 600;

      if (e.translationX > DIST || e.velocityX > VEL) {
        translateX.value = withSpring(SW * 1.6, { damping: 18 });
        runOnJS(doSwipeRight)();
      } else if (e.translationX < -DIST || e.velocityX < -VEL) {
        translateX.value = withSpring(-SW * 1.6, { damping: 18 });
        runOnJS(doSwipeLeft)();
      } else if (e.translationY < -DIST || e.velocityY < -VEL) {
        translateY.value = withSpring(-SH, { damping: 18 });
        runOnJS(doSwipeUp)();
      } else {
        translateX.value = withSpring(0, { damping: 22 });
        translateY.value = withSpring(0, { damping: 22 });
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd(() => {
      runOnJS(doTap)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(600)
    .onStart(() => {
      runOnJS(doLongPress)();
    });

  // Long press races against pan+tap — first recognised wins
  const composed = Gesture.Race(longPress, Gesture.Race(pan, tap));

  // ── Animated styles ───────────────────────────────────────────────────────

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = (translateX.value / SW) * 14;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      zIndex: 2,
    };
  });

  const peekCardStyle: object = {
    transform: [{ scale: 0.96 }, { translateY: 12 }],
    opacity: 0.6,
    zIndex: 1,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (queue.length === 0) return null;

  const topCard = queue[0];
  const peekCard = queue[1] ?? null;

  return (
    <View style={styles.container}>
      {/* Peeking card */}
      {peekCard ? (
        <Animated.View
          style={[styles.cardWrapper, peekCardStyle]}
          pointerEvents="none"
        >
          <SignalCard event={peekCard} />
        </Animated.View>
      ) : null}

      {/* Active card */}
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.cardWrapper, topCardStyle]}>
          <SignalCard event={topCard} />
        </Animated.View>
      </GestureDetector>

      {/* Gesture hints */}
      {hintsVisible ? (
        <View style={styles.hintsRow} pointerEvents="none">
          <Text style={styles.hint}>← Dismiss{'   '}↑ Later{'   '}Accept →</Text>
        </View>
      ) : null}

      {/* Detail view */}
      {detailEvent ? (
        <DetailView event={detailEvent} onClose={() => setDetailEvent(null)} />
      ) : null}

      {/* Inspect panel */}
      {inspectEvent ? (
        <InspectPanel
          event={inspectEvent}
          onClose={() => setInspectEvent(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  hintsRow: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
