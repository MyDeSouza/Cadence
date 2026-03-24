import { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  useFonts,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from '@expo-google-fonts/outfit';

import { useTimeOfDay } from './hooks/useTimeOfDay';
import { useSignals } from './hooks/useSignals';
import { TopSection } from './components/TopSection';
import { CardStack } from './components/CardStack';
import { InputBar } from './components/InputBar';
import { EmptyState } from './components/EmptyState';

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  const { period, colors, locations } = useTimeOfDay();
  const { signals, allEvents, refresh } = useSignals();

  // Gesture hint counter — fade after 3 interactions
  const [hintCount, setHintCount] = useState(0);

  // Green flash overlay on swipe-right (actioned)
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const handleFlashGreen = useCallback(() => {
    flashOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 300 })
    );
  }, []);

  const handleInteraction = useCallback(() => {
    setHintCount((n) => n + 1);
  }, []);

  if (!fontsLoaded) return null;

  const hasSignals = signals.length > 0;

  return (
    <GestureHandlerRootView style={styles.root}>
      <LinearGradient
        // expo-linear-gradient requires a tuple — cast via any to avoid false TS error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colors={colors as any}
        locations={locations as any}
        style={styles.gradient}
      >
        <StatusBar style="light" translucent backgroundColor="transparent" />

        {/* Green flash overlay — swipe right feedback */}
        <Animated.View
          style={[styles.flashOverlay, flashStyle]}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.safe}>
          {/* Top: mark + pills + greeting */}
          <TopSection
            period={period}
            signals={signals}
            allEvents={allEvents}
          />

          {/* Middle: card stack or empty state */}
          <View style={styles.middle}>
            {hasSignals ? (
              <CardStack
                signals={signals}
                onFlashGreen={handleFlashGreen}
                hintsVisible={hintCount < 3}
                onInteraction={handleInteraction}
              />
            ) : (
              <EmptyState allEvents={allEvents} />
            )}
          </View>

          {/* Bottom: input bar */}
          <InputBar onTaskAdded={refresh} />
        </SafeAreaView>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200,240,96,0.3)',
    zIndex: 50,
    pointerEvents: 'none',
  },
});
