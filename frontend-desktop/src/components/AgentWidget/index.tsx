import { useState, useRef, useEffect } from 'react';
import type { Attendee, CadenceEvent } from '../../types';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import styles from './AgentWidget.module.css';
import { API_BASE } from '../../constants/api';

type Tab = 'agent' | 'people' | 'search';

interface SearchResult {
  title:   string;
  link:    string;
  snippet: string;
}

interface ActionBlock {
  type:     'reschedule' | 'move';
  eventId:  string;
  newStart: string;
  newEnd:   string;
  reason:   string;
}

interface Message {
  id:         string;
  role:       'user' | 'assistant';
  content:    string;
  streaming?: boolean;
  actions?:   ActionBlock[];
}

// Strips complete ACTION:{...} tokens from a finished response
const ACTION_DISPLAY_RE = /ACTION:\s*\{[^}]*\}/g;
function stripActions(text: string): string {
  return text.replace(ACTION_DISPLAY_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

// During streaming the JSON is incomplete (no closing }) so the regex above
// never matches.  Cut everything from the first ACTION: to end-of-string instead.
function stripActionsStreaming(text: string): string {
  return text.replace(/ACTION:[\s\S]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Split a completed assistant response into prose text + ACTION blocks.
 *  Uses a regex scan of the full string so it catches ACTION blocks regardless
 *  of whether the JSON is on the same line, the next line, or mid-paragraph.
 *  Matched ACTION:... tokens are stripped from the prose before returning.
 */
function parseActions(raw: string): { content: string; actions: ActionBlock[] } {
  const actions: ActionBlock[] = [];
  // Match ACTION: + optional whitespace + JSON object (non-greedy, no nested {})
  const ACTION_RE = /ACTION:\s*(\{[\s\S]*?\})/g;
  let prose = raw;
  let match: RegExpExecArray | null;

  while ((match = ACTION_RE.exec(raw)) !== null) {
    try {
      actions.push(JSON.parse(match[1]) as ActionBlock);
      prose = prose.replace(match[0], '');
    } catch { /* malformed — skip */ }
  }

  return { content: prose.trim(), actions };
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
      <rect x="4" y="1" width="6" height="9" rx="3" stroke="#161717" strokeWidth="1.5" strokeOpacity="0.8" />
      <path d="M1 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="#161717" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="7" y1="14" x2="7" y2="17" stroke="#161717" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
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
  if (match && match.index !== undefined) {
    const subject = match[1].trim();
    // Use match.index (set by the regex engine) to reliably locate the line,
    // then skip past it and its trailing newline before trimming the body.
    const afterLine = content.slice(match.index + match[0].length);
    const body      = afterLine.replace(/^\r?\n/, '').trim();
    return { subject, body };
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

function PlanIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="11" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 5.5H12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  theme:            Theme;
  events:           CadenceEvent[];
  onActionApplied:  () => void;
}

export function AgentWidget({ theme, events, onActionApplied }: Props) {
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
  const [planning,      setPlanning]      = useState(false);
  const [planStatus,    setPlanStatus]    = useState<string | null>(null);
  // Tracks per-action state: key = `${msgId}-${actionIndex}`, value = 'done' | 'skipped'
  const [actionStates,  setActionStates]  = useState<Record<string, 'done' | 'skipped'>>({});
  const [calendars,     setCalendars]     = useState<Array<{ id: string; name: string }>>([]);
  const [planCalId,     setPlanCalId]     = useState('primary');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  // Fetch calendar list once when the panel opens
  useEffect(() => {
    if (!expanded) return;
    fetch(`${API_BASE}/sync/google/calendars`)
      .then((r) => r.json())
      .then((d: { calendars?: Array<{ id: string; name: string }> }) => {
        if (d.calendars?.length) {
          setCalendars(d.calendars);
          setPlanCalId(d.calendars[0].id);
        }
      })
      .catch(() => {});
  }, [expanded]);

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
        prev.map((m) => {
          if (m.id !== asstMsgId) return m;
          const { content, actions } = parseActions(m.content);
          return { ...m, streaming: false, content, actions };
        })
      );
      setIsLoading(false);
    }
  };

  const applyAction = async (key: string, action: ActionBlock) => {
    setActionStates((prev) => ({ ...prev, [key]: 'done' }));
    try {
      await fetch(`${API_BASE}/apply-action`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: action.type, eventId: action.eventId, newStart: action.newStart, newEnd: action.newEnd }),
      });
      onActionApplied();
    } catch { /* best-effort */ }
  };

  const skipAction = (key: string) => {
    setActionStates((prev) => ({ ...prev, [key]: 'skipped' }));
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

  const planTomorrow = async () => {
    if (planning) return;
    setPlanning(true);
    setPlanStatus('Planning your tomorrow…');
    try {
      const res  = await fetch(`${API_BASE}/plan-tomorrow`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ calendarId: planCalId }),
      });
      const data = await res.json() as { created?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed');
      setPlanStatus(`✓ Added ${data.created} event${data.created === 1 ? '' : 's'} to your calendar for tomorrow.`);
      onActionApplied();
      setTimeout(() => setPlanStatus(null), 4000);
    } catch (err) {
      setPlanStatus(err instanceof Error ? err.message : 'Could not plan tomorrow.');
      setTimeout(() => setPlanStatus(null), 4000);
    } finally {
      setPlanning(false);
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
                      {msg.streaming ? stripActionsStreaming(msg.content) : stripActions(msg.content)}
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
                    {msg.role === 'assistant' && !msg.streaming && (() => {
                      const acts = msg.actions ?? [];
                      if (acts.length === 0) return null;

                      // All resolved = every action is done or skipped
                      const allResolved = acts.every((_, i) => actionStates[`${msg.id}-${i}`] !== undefined);
                      if (allResolved) {
                        const doneCount = acts.filter((_, i) => actionStates[`${msg.id}-${i}`] === 'done').length;
                        if (doneCount === 0) return null; // all skipped — show nothing
                        return (
                          <span className={`${styles.actionDone} ${styles[`actionDone_${theme}`]}`}>
                            ✓ {doneCount === 1 ? 'Change applied' : `${doneCount} changes applied`}
                          </span>
                        );
                      }

                      // Still pending — show only unresolved cards
                      return acts.map((action, i) => {
                        const key   = `${msg.id}-${i}`;
                        const state = actionStates[key];
                        if (state !== undefined) return null; // hide resolved cards
                        return (
                          <div key={key} className={`${styles.actionCard} ${styles[`actionCard_${theme}`]}`}>
                            <span className={`${styles.actionType} ${styles[`actionType_${theme}`]}`}>
                              {action.type === 'reschedule' ? 'Reschedule' : 'Move'}
                            </span>
                            <span className={`${styles.actionReason} ${styles[`actionReason_${theme}`]}`}>
                              {action.reason}
                            </span>
                            <span className={`${styles.actionTime} ${styles[`actionTime_${theme}`]}`}>
                              {new Date(action.newStart).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                              {' → '}
                              {new Date(action.newEnd).toLocaleTimeString('en-GB', { timeStyle: 'short' })}
                            </span>
                            <div className={styles.actionBtns}>
                              <button
                                className={`${styles.actionApply} ${styles[`actionApply_${theme}`]}`}
                                onClick={() => applyAction(key, action)}
                              >
                                ✓ Apply
                              </button>
                              <button
                                className={`${styles.actionSkip} ${styles[`actionSkip_${theme}`]}`}
                                onClick={() => skipAction(key)}
                              >
                                ✗ Skip
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
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
                {calendars.length > 1 && (
                  <select
                    className={`${styles.calPicker} ${styles[`calPicker_${theme}`]}`}
                    value={planCalId}
                    onChange={(e) => setPlanCalId(e.target.value)}
                    title="Calendar for planned events"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <button
                  className={`${styles.composeBtn} ${styles[`composeBtn_${theme}`]}`}
                  onClick={planTomorrow}
                  disabled={planning}
                  aria-label="Plan tomorrow"
                  title="Plan tomorrow"
                >
                  <PlanIcon />
                </button>
              </div>

              {planStatus && (
                <div className={`${styles.planStatus} ${styles[`planStatus_${theme}`]}`}>
                  {planStatus}
                </div>
              )}

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
