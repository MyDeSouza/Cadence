import { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Keyboard,
  Alert,
} from 'react-native';
import { API_BASE } from '../constants/api';

interface Props {
  onTaskAdded?: () => void;
}

export function InputBar({ onTaskAdded }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    Keyboard.dismiss();
    try {
      await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, source: 'manual' }),
      });
      onTaskAdded?.();
    } catch {
      Alert.alert('Could not add task', 'Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Input field */}
      <View style={styles.inputWrapper}>
        {/* Location pin icon — two Views forming a pin */}
        <View style={styles.pinIcon}>
          <View style={styles.pinCircle} />
          <View style={styles.pinTail} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Ask..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="send"
          selectionColor="white"
        />
      </View>

      {/* Mic button */}
      <Pressable style={styles.micBtn} onPress={submit}>
        {/* Mic icon — capsule body + stand */}
        <View style={styles.micBody} />
        <View style={styles.micStand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 36,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(35,54,78,0.32)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: 'white',
    paddingVertical: 0,
  },
  // Simple pin icon
  pinIcon: {
    width: 12,
    height: 16,
    alignItems: 'center',
  },
  pinCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pinTail: {
    width: 1.5,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginTop: -1,
  },
  // Mic button
  micBtn: {
    width: 39,
    height: 32,
    backgroundColor: 'rgba(35,54,78,0.32)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  micBody: {
    width: 9,
    height: 13,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  micStand: {
    width: 13,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1,
  },
});
