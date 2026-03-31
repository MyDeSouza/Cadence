import { useState, useRef, useEffect } from 'react';
import type { Attendee, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import { useDigest } from '../../hooks/useDigest';
import styles from './AgentWidget.module.css';
import { API_BASE } from '../../constants/api';

type Tab = 'agent' | 'people';

interface Message {
  id:         string;
  role:       'user' | 'assistant';
  content:    string;
  streaming?: boolean;
}

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
      <path d="M1 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="7" y1="14" x2="7" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

interface Props {
  theme: Theme;
}

export function AgentWidget({ theme }: Props) {
  const [expanded,  setExpanded]  = useState(false);
  const [tab,       setTab]       = useState<Tab>('agent');
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const { events } = useDigest();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopStream = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const text      = input.trim();
    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user',      content: text },
      { id: asstMsgId, role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setIsLoading(true);

    const controller   = new AbortController();
    abortRef.current   = controller;

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
        signal:  controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('bad response');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? { ...m, content: 'Unable to reach the model. Is Ollama running?' }
              : m
          )
        );
      }
    } finally {
      abortRef.current = null;
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsgId ? { ...m, streaming: false } : m))
      );
      setIsLoading(false);
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
                    Ask anything about your day.
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={[
                      styles.message,
                      msg.role === 'user'
                        ? styles[`msgUser_${theme}`]
                        : styles[`msgAssistant_${theme}`],
                    ].join(' ')}
                  >
                    {msg.content}
                    {msg.streaming && msg.content === '' && (
                      <span className={`${styles.streamDot} ${styles[`streamDot_${theme}`]}`} />
                    )}
                    {msg.streaming && msg.content !== '' && (
                      <span className={`${styles.streamCursor} ${styles[`streamCursor_${theme}`]}`} />
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Stop button — only while streaming */}
              {isLoading && (
                <div className={`${styles.stopRow} ${styles[`stopRow_${theme}`]}`}>
                  <button
                    className={`${styles.stopBtn} ${styles[`stopBtn_${theme}`]}`}
                    onClick={stopStream}
                  >
                    <StopIcon />
                    Stop
                  </button>
                </div>
              )}

              <div className={`${styles.inputRow} ${styles[`inputRow_${theme}`]}`}>
                <input
                  className={`${styles.chatInput} ${styles[`chatInput_${theme}`]}`}
                  placeholder={isLoading ? 'Thinking…' : 'Message…'}
                  value={input}
                  disabled={isLoading}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </>
          )}

          {tab === 'people' && (() => {
            const focusEvent = getActiveFocusEvent(events);
            const attendees  = focusEvent?.attendees ?? [];
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
                    onClick={() => setTab('agent')}
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
