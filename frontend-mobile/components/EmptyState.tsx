import { View, Text, StyleSheet } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import type { CadenceEvent } from '../types';

interface Props {
  allEvents: CadenceEvent[];
}

export function EmptyState({ allEvents }: Props) {
  const { text } = useCountdown(allEvents);

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
