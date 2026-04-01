import { useState, useRef, useEffect } from 'react';
import type { Attendee, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import { useDigest } from '../../hooks/useDigest';
import styles from './AgentWidget.module.css';
import { API_BASE } from '../../constants/api';

type Tab = 'agent' | 'people' | 'search';

interface SearchResult {
  title:   string;
  link:    string;
  snippet: string;
}

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

const SIGN_OFF_RE = /\b(best regards|kind regards|warm regards|sincerely|yours sincerely|yours truly|best wishes|many thanks|thanks|cheers|regards)\s*[,.]?\s*$/im;

function looksLikeEmail(content: string): boolean {
  if (!content || content.length < 20) return false;
  if (/subject:/i.test(content))   return true;
  if (/\bDear\b/i.test(content))   return true;
  if (SIGN_OFF_RE.test(content.trim())) return true;
  return false;
}

function parseDraft(content: string): { subject: string; body: string } {
  const match = content.match(/^subject:\s*(.+)/im);
  if (match) {
    const subject    = match[1].trim();
    const afterSubj  = content.slice(content.indexOf(match[0]) + match[0].length).trim();
    return { subject, body: afterSubj };
  }
  return { subject: '', body: content.trim() };
}

function ComposeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M9.5 1.5L11.5 3.5L4.5 10.5H2.5V8.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M1.5 11.5H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  theme: Theme;
}

export function AgentWidget({ theme }: Props) {
  const [expanded,      setExpanded]      = useState(false);
  const [tab,           setTab]           = useState<Tab>('agent');
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState('');
  const [isLoading,     setIsLoading]     = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [searchError,   setSearchError]   = useState<string | null>(null);
  const [composing,     setComposing]     = useState(false);
  const [composeTo,     setComposeTo]     = useState('');
  const [composeSubj,   setComposeSubj]   = useState('');
  const [composeBody,   setComposeBody]   = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendSuccess,   setSendSuccess]   = useState(false);
  const [sendError,     setSendError]     = useState<string | null>(null);
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

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as { results: SearchResult[] };
      setSearchResults(data.results ?? []);
    } catch {
      setSearchError('Search failed. Check your API key configuration.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  const openCompose = (prefill?: { subject: string; body: string }) => {
    setComposeTo('');
    setComposeSubj(prefill?.subject ?? '');
    setComposeBody(prefill?.body ?? '');
    setSendError(null);
    setSendSuccess(false);
    setComposing(true);
  };

  const closeCompose = () => {
    setComposing(false);
    setSendSuccess(false);
    setSendError(null);
  };

  const sendEmail = async () => {
    if (!composeTo.trim() || !composeSubj.trim() || !composeBody.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`${API_BASE}/send-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to: composeTo.trim(), subject: composeSubj.trim(), body: composeBody.trim() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Send failed');
      setSendSuccess(true);
      setTimeout(() => closeCompose(), 1800);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
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
              <div className={styles.messages}
                style={composing ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
              >
                {messages.length === 0 && (
                  <div className={`${styles.emptyChat} ${styles[`emptyChat_${theme}`]}`}>
                    Ask anything about your day.
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={styles.msgWrapper}>
                    <div
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
                    {msg.role === 'assistant' && !msg.streaming && looksLikeEmail(msg.content) && (
                      <button
                        className={`${styles.sendThisBtn} ${styles[`sendThisBtn_${theme}`]}`}
                        onClick={() => openCompose(parseDraft(msg.content))}
                      >
                        → Send this
                      </button>
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
                  disabled={isLoading || composing}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className={`${styles.composeBtn} ${styles[`composeBtn_${theme}`]}`}
                  onClick={() => openCompose()}
                  aria-label="Compose email"
                  title="Compose email"
                >
                  <ComposeIcon />
                </button>
              </div>

              {composing && (
                <div className={`${styles.composePanel} ${styles[`composePanel_${theme}`]}`}>
                  {sendSuccess ? (
                    <div className={`${styles.composeSuccess} ${styles[`composeSuccess_${theme}`]}`}>
                      ✓ Sent
                    </div>
                  ) : (
                    <>
                      <div className={`${styles.composeHeader} ${styles[`composeHeader_${theme}`]}`}>
                        <span className={styles.composeTitle}>New message</span>
                        <button
                          className={`${styles.composeDismiss} ${styles[`composeDismiss_${theme}`]}`}
                          onClick={closeCompose}
                          aria-label="Close compose"
                        >
                          ×
                        </button>
                      </div>

                      <input
                        className={`${styles.composeField} ${styles[`composeField_${theme}`]}`}
                        placeholder="To"
                        value={composeTo}
                        onChange={(e) => setComposeTo(e.target.value)}
                        disabled={sending}
                      />
                      <input
                        className={`${styles.composeField} ${styles[`composeField_${theme}`]}`}
                        placeholder="Subject"
                        value={composeSubj}
                        onChange={(e) => setComposeSubj(e.target.value)}
                        disabled={sending}
                      />
                      <textarea
                        className={`${styles.composeBody} ${styles[`composeBody_${theme}`]}`}
                        placeholder="Message"
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        disabled={sending}
                        rows={4}
                      />

                      {sendError && (
                        <div className={`${styles.composeError} ${styles[`composeError_${theme}`]}`}>
                          {sendError}
                        </div>
                      )}

                      <div className={`${styles.composeSendRow} ${styles[`composeSendRow_${theme}`]}`}>
                        <button
                          className={`${styles.composeSendBtn} ${styles[`composeSendBtn_${theme}`]}`}
                          onClick={sendEmail}
                          disabled={sending || !composeTo.trim() || !composeSubj.trim() || !composeBody.trim()}
                        >
                          {sending ? 'Sending…' : 'Send'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
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

          {/* Search tab hidden from UI — restore by changing false to: tab === 'search' */}
          {false && tab === 'search' && (
            <div className={styles.searchTab}>
              <div className={`${styles.searchInputRow} ${styles[`searchInputRow_${theme}`]}`}>
                <input
                  className={`${styles.searchInput} ${styles[`searchInput_${theme}`]}`}
                  placeholder="Search the web…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  disabled={searching}
                />
              </div>

              <div className={styles.searchResults}>
                {searching && (
                  <div className={`${styles.searchStatus} ${styles[`searchStatus_${theme}`]}`}>
                    Searching…
                  </div>
                )}
                {searchError && (
                  <div className={`${styles.searchStatus} ${styles[`searchStatus_${theme}`]}`}>
                    {searchError}
                  </div>
                )}
                {!searching && !searchError && searchResults.length === 0 && (
                  <div className={`${styles.searchStatus} ${styles[`searchStatus_${theme}`]}`}>
                    {searchQuery ? 'No results.' : 'Type and press Enter to search.'}
                  </div>
                )}
                {searchResults.map((r) => (
                  <a
                    key={r.link}
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.searchCard} ${styles[`searchCard_${theme}`]}`}
                  >
                    <span className={`${styles.searchCardTitle} ${styles[`searchCardTitle_${theme}`]}`}>
                      {r.title}
                    </span>
                    <span className={`${styles.searchCardSnippet} ${styles[`searchCardSnippet_${theme}`]}`}>
                      {r.snippet}
                    </span>
                    <span className={`${styles.searchCardLink} ${styles[`searchCardLink_${theme}`]}`}>
                      {r.link}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
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
