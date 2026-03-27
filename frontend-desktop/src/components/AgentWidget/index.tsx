import { useState, useRef, useEffect } from 'react';
import type { Attendee, CadenceEvent, TonePosition } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import { ToneSelector } from '../ToneSelector';
import { useDigest } from '../../hooks/useDigest';
import styles from './AgentWidget.module.css';
import { API_BASE } from '../../constants/api';

type Tab = 'agent' | 'people';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_TONE: TonePosition = { label: 'Neutral', x: 0.5, y: 0.5 };

function getInitials(attendee: Attendee): string {
  if (attendee.name) {
    const parts = attendee.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return attendee.email.slice(0, 2).toUpperCase();
}

const STATUS_LABELS: Record<Attendee['status'], string> = {
  accepted:    '✓ Going',
  tentative:   '? Maybe',
  needsAction: '— Pending',
  declined:    '✗ Declined',
};

function getActiveFocusEvent(events: CadenceEvent[]): CadenceEvent | null {
  const now = new Date();
  const active = events.find((e) => {
    const start = new Date(e.timestamp);
    const end = e.deadline ? new Date(e.deadline) : new Date(start.getTime() + 3_600_000);
    return start <= now && now <= end;
  });
  if (active) return active;
  return events.find((e) => new Date(e.timestamp) > now) ?? null;
}

function MicIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
      <rect x="4" y="1" width="6" height="9" rx="3" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" />
      <path
        d="M1 8c0 3.314 2.686 6 6 6s6-2.686 6-6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
      <line x1="7" y1="14" x2="7" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  );
}

interface Props {
  theme: Theme;
}

export function AgentWidget({ theme }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('agent');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showIdeation, setShowIdeation] = useState(false);
  const [ideationDraft, setIdeationDraft] = useState('');
  const [tone, setTone] = useState<TonePosition>(DEFAULT_TONE);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { events } = useDigest();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input, source: 'agent' }),
      });
    } catch {
      // silent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.wrapper}>
      {expanded && (
        <div className={`${styles.panel} ${styles[`panel_${theme}`]}`}>
          {/* Tabs */}
          <div className={`${styles.tabs} ${styles[`tabs_${theme}`]}`}>
            <button
              className={`${styles.tabBtn} ${styles[`tabBtn_${theme}`]} ${tab === 'agent' ? styles.tabActive : ''}`}
              onClick={() => setTab('agent')}
            >
              Agent
            </button>
            <button
              className={`${styles.tabBtn} ${styles[`tabBtn_${theme}`]} ${tab === 'people' ? styles.tabActive : ''}`}
              onClick={() => setTab('people')}
            >
              People
            </button>
          </div>

          {tab === 'agent' && (
            <>
              <div className={styles.messages}>
                {messages.length === 0 && (
                  <div className={`${styles.emptyChat} ${styles[`emptyChat_${theme}`]}`}>
                    Ask anything, add a task, or compose a message.
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${msg.role === 'user' ? styles[`msgUser_${theme}`] : styles[`msgAssistant_${theme}`]}`}
                  >
                    {msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className={`${styles.ideationToggleRow} ${styles[`ideationToggleRow_${theme}`]}`}>
                <button
                  className={`${styles.ideationToggle} ${styles[`ideationToggle_${theme}`]}`}
                  onClick={() => setShowIdeation((v) => !v)}
                >
                  {showIdeation ? 'Hide compose' : 'Compose message'}
                </button>
              </div>

              {showIdeation && (
                <div className={`${styles.ideation} ${styles[`ideation_${theme}`]}`}>
                  <textarea
                    className={`${styles.ideationArea} ${styles[`ideationArea_${theme}`]}`}
                    placeholder="Draft a message..."
                    value={ideationDraft}
                    onChange={(e) => setIdeationDraft(e.target.value)}
                    rows={3}
                  />
                  <ToneSelector value={tone} onChange={setTone} />
                </div>
              )}

              <div className={`${styles.inputRow} ${styles[`inputRow_${theme}`]}`}>
                <input
                  className={`${styles.chatInput} ${styles[`chatInput_${theme}`]}`}
                  placeholder="Message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </>
          )}

          {tab === 'people' && (() => {
            const focusEvent = getActiveFocusEvent(events);
            const attendees = focusEvent?.attendees ?? [];
            if (attendees.length === 0) {
              return (
                <div className={styles.people}>
                  <div className={`${styles.emptyPeople} ${styles[`emptyPeople_${theme}`]}`}>
                    No collaborators in active events
                  </div>
                </div>
              );
            }
            return (
              <div className={styles.people}>
                <div className={`${styles.peopleEventLabel} ${styles[`peopleEventLabel_${theme}`]}`}>
                  {focusEvent!.title}
                </div>
                {attendees.map((a) => (
                  <button
                    key={a.email}
                    className={`${styles.attendeeRow} ${styles[`attendeeRow_${theme}`]}`}
                    onClick={() => {
                      setIdeationDraft(`To: ${a.email}\n\n`);
                      setShowIdeation(true);
                      setTab('agent');
                    }}
                  >
                    <span className={`${styles.attendeeAvatar} ${styles[`attendeeAvatar_${theme}`]}`}>
                      {getInitials(a)}
                    </span>
                    <span className={styles.attendeeInfo}>
                      <span className={`${styles.attendeeName} ${styles[`attendeeName_${theme}`]}`}>
                        {a.name ?? a.email}
                        {a.organiser && (
                          <span className={`${styles.organiserTag} ${styles[`organiserTag_${theme}`]}`}>org</span>
                        )}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[`status_${a.status}`]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Collapsed pill: Ask... + mic button */}
      <div className={styles.collapsedRow}>
        <button
          className={`${styles.askPill} ${styles[`askPill_${theme}`]}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          Ask...
        </button>
        <button
          className={`${styles.micBtn} ${styles[`micBtn_${theme}`]}`}
          onClick={() => setExpanded((v) => !v)}
          aria-label="Voice input"
        >
          <MicIcon />
        </button>
      </div>
    </div>
  );
}
