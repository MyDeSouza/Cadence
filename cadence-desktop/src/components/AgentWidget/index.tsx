import { useState, useRef, useEffect } from 'react';
import type { TonePosition } from '../../types';
import { ToneSelector } from '../ToneSelector';
import styles from './AgentWidget.module.css';

const API_BASE = 'http://localhost:3001';

type Tab = 'agent' | 'people';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_TONE: TonePosition = { label: 'Neutral', x: 0.5, y: 0.5 };

export function AgentWidget() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('agent');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showIdeation, setShowIdeation] = useState(false);
  const [ideationDraft, setIdeationDraft] = useState('');
  const [tone, setTone] = useState<TonePosition>(DEFAULT_TONE);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        <div className={styles.panel}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${tab === 'agent' ? styles.tabActive : ''}`}
              onClick={() => setTab('agent')}
            >
              Agent
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'people' ? styles.tabActive : ''}`}
              onClick={() => setTab('people')}
            >
              People
            </button>
          </div>

          {tab === 'agent' && (
            <>
              {/* Messages */}
              <div className={styles.messages}>
                {messages.length === 0 && (
                  <div className={styles.emptyChat}>
                    Ask anything, add a task, or compose a message.
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
                  >
                    {msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Ideation toggle */}
              <div className={styles.ideationToggleRow}>
                <button
                  className={styles.ideationToggle}
                  onClick={() => setShowIdeation((v) => !v)}
                >
                  {showIdeation ? 'Hide compose' : 'Compose message'}
                </button>
              </div>

              {showIdeation && (
                <div className={styles.ideation}>
                  <textarea
                    className={styles.ideationArea}
                    placeholder="Draft a message..."
                    value={ideationDraft}
                    onChange={(e) => setIdeationDraft(e.target.value)}
                    rows={3}
                  />
                  <ToneSelector value={tone} onChange={setTone} />
                </div>
              )}

              {/* Input */}
              <div className={styles.inputRow}>
                <input
                  className={styles.chatInput}
                  placeholder="Message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </>
          )}

          {tab === 'people' && (
            <div className={styles.people}>
              <div className={styles.emptyPeople}>No collaborators in active events</div>
            </div>
          )}
        </div>
      )}

      <button
        className={`${styles.pill} ${expanded ? styles.pillActive : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.pillDot} />
        <span>Ask...</span>
      </button>
    </div>
  );
}
