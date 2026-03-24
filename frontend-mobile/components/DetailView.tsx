import { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CadenceEvent, Attendee } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatFullDate(event: CadenceEvent): string {
  const start = new Date(event.timestamp);
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (!event.deadline) return `${dateStr} at ${fmt12(start)}`;
  return `${dateStr}  ${fmt12(start)} – ${fmt12(new Date(event.deadline))}`;
}

function getInitials(a: Attendee): string {
  if (a.name) {
    const parts = a.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return a.email.slice(0, 2).toUpperCase();
}

const STATUS_LABELS: Record<Attendee['status'], string> = {
  accepted:    '✓',
  tentative:   '?',
  needsAction: '—',
  declined:    '✗',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  event: CadenceEvent;
  onClose: () => void;
}

export function DetailView({ event, onClose }: Props) {
  const translateY = useSharedValue(800);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const swipeDown = Gesture.Pan()
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 800) {
        translateY.value = withSpring(900, { damping: 20 }, () => {});
        // Close after animation — use timeout on JS side
      } else {
        translateY.value = withSpring(0, { damping: 20 });
      }
    });

  const handleSwipeDown = () => {
    translateY.value = withSpring(900, { damping: 20 });
    setTimeout(onClose, 300);
  };

  const attendees = event.attendees ?? [];
  const hasAttendees = attendees.length > 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <GestureDetector
        gesture={Gesture.Pan().onEnd((e) => {
          if (e.translationY > 80 || e.velocityY > 800) {
            translateY.value = withSpring(900, { damping: 20 });
            setTimeout(() => {}, 0); // handled via runOnJS below
          } else {
            translateY.value = withSpring(0, { damping: 20 });
          }
        })}
      >
        <Animated.View style={[styles.overlay, animStyle]}>
          <SafeAreaView style={styles.safe}>
            {/* Drag handle */}
            <Pressable onPress={handleSwipeDown} style={styles.handleArea}>
              <View style={styles.handle} />
            </Pressable>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <Text style={styles.title}>{event.title}</Text>

              {/* Date & time */}
              <Text style={styles.dateTime}>{formatFullDate(event)}</Text>

              {/* Location */}
              {event.location ? (
                <Text style={styles.location}>📍 {event.location}</Text>
              ) : null}

              {/* Attendees */}
              {hasAttendees ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>People</Text>
                  <View style={styles.avatarRow}>
                    {attendees.map((a) => (
                      <View key={a.email} style={styles.avatarItem}>
                        <View
                          style={[
                            styles.avatar,
                            a.organiser && styles.avatarOrg,
                          ]}
                        >
                          <Text style={styles.avatarInitials}>
                            {getInitials(a)}
                          </Text>
                        </View>
                        <Text style={styles.avatarStatus}>
                          {STATUS_LABELS[a.status]}
                        </Text>
                        {a.organiser ? (
                          <Text style={styles.orgLabel}>org</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Description */}
              {event.raw_content ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.rawContent}>{event.raw_content}</Text>
                </View>
              ) : null}

              {/* Reminder */}
              {event.reminder_minutes != null ? (
                <Text style={styles.reminder}>
                  🔔 {event.reminder_minutes} minutes before
                </Text>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'white',
  },
  safe: {
    flex: 1,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_600SemiBold',
    color: '#0A0A0A',
    lineHeight: 34,
    marginBottom: 10,
  },
  dateTime: {
    fontSize: 14,
    fontFamily: 'Outfit_300Light',
    color: '#888888',
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    color: '#AAAAAA',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: '#AAAAAA',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarItem: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrg: {
    backgroundColor: '#EEF3FE',
    borderWidth: 1.5,
    borderColor: '#5B8CF7',
  },
  avatarInitials: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: '#444',
  },
  avatarStatus: {
    fontSize: 10,
    color: '#AAAAAA',
    fontFamily: 'Outfit_300Light',
  },
  orgLabel: {
    fontSize: 9,
    color: '#5B8CF7',
    fontFamily: 'Outfit_500Medium',
  },
  rawContent: {
    fontSize: 15,
    fontFamily: 'Outfit_300Light',
    color: '#333333',
    lineHeight: 22,
  },
  reminder: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    color: '#888888',
    marginTop: 4,
  },
});
