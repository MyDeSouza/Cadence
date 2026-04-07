import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../constants/api';
import { parseCanvasCommand } from '../../utils/canvasCommands';
import type { CanvasCommand } from '../../utils/canvasCommands';
import styles from './AgentWidget.module.css';

type DraftType = 'email' | 'document';
type Step = 'idle' | 'idea' | 'recipient' | 'type' | 'generating';
type BubbleState = 'idle' | 'visible' | 'fading';

interface Props {
  onDraftGenerated:  (draft: { type: DraftType; content: string }) => void;
  onCanvasCommand?: (cmd: CanvasCommand) => void;
}

// ── Icons ────────────────────────────────────────────────
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L11.8 8.2L18 10L11.8 11.8L10 18L8.2 11.8L2 10L8.2 8.2L10 2Z" fill="white" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="12" rx="2" stroke="white" strokeWidth="1.5" />
      <path d="M2 8l8 5 8-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 2h7l4 4v13H5V2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 2v4h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7" y1="11" x2="13" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7" y1="14" x2="11" y2="14" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M5 8l4 4 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────
/** Extract a name reference from the idea text (e.g. "ask Sarah about..." → "Sarah") */
function detectName(text: string): string | null {
  const m = text.match(
    /\b(?:to|for|with|ask|tell|email|update|message|invite|remind|contact|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
  );
  return m ? m[1] : null;
}

/** Extract "Subject: ..." from an email draft string */
function extractSubject(text: string): string {
  const m = text.match(/^Subject:\s*(.+)/mi);
  return m ? m[1].trim() : '';
}

/** Parse delimiter-separated 3-version response */
function parseVersions(raw: string): { direct: string; casual: string; professional: string } {
  const extract = (key: string) => {
    const re = new RegExp(`---${key}---\\s*([\\s\\S]*?)(?=\\s*---[A-Z]+---|$)`, 'i');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };
  const direct       = extract('DIRECT');
  const casual       = extract('CASUAL');
  const professional = extract('PROFESSIONAL');
  // Fallback: if parsing fails, use full text for all three
  return {
    direct:       direct       || raw.trim(),
    casual:       casual       || raw.trim(),
    professional: professional || raw.trim(),
  };
}

// ── Main component ──────────────────────────────────────
export function AgentWidget({ onDraftGenerated, onCanvasCommand }: Props) {
  const [step,          setStep]          = useState<Step>('idle');
  const [ideaText,      setIdeaText]      = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [draftType,     setDraftType]     = useState<DraftType | null>(null);
  const [emailTo,       setEmailTo]       = useState('');

  const [askInput,     setAskInput]     = useState('');
  const [responseText, setResponseText] = useState('');
  const [bubbleState,  setBubbleState]  = useState<BubbleState>('idle');
  const [askStreaming,  setAskStreaming]  = useState(false);

  const abortRef     = useRef<AbortController | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailToRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, []);

  // ── Ask / direct chat ────────────────────────────────
  const showBubble = (text: string, durationMs = 4_000) => {
    setResponseText(text);
    setBubbleState('visible');
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setBubbleState('fading');
      setTimeout(() => { setBubbleState('idle'); setResponseText(''); }, 500);
    }, durationMs);
  };

  const sendAsk = async () => {
    const text = askInput.trim();
    if (!text || askStreaming) return;
    setAskInput('');

    // ── Canvas command intercept ───────────────────────
    const parsed = parseCanvasCommand(text);
    if (parsed) {
      if (parsed.command.kind === 'nextEvent') {
        // Fetch events and surface the next one in the bubble
        showBubble('Checking next event…', 10_000);
        try {
          const res  = await fetch(`${API_BASE}/events`);
          const data = await res.json() as Array<{ title: string; timestamp: string }>;
          const now  = Date.now();
          const next = data
            .map(e => ({ ...e, ms: new Date(e.timestamp).getTime() }))
            .filter(e => e.ms > now)
            .sort((a, b) => a.ms - b.ms)[0];
          const msg = next
            ? `Next: ${next.title} at ${new Date(next.ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No upcoming events found';
          showBubble(msg, 6_000);
        } catch {
          showBubble('Could not load events', 4_000);
        }
      } else {
        showBubble(parsed.confirmation, 3_000);
        onCanvasCommand?.(parsed.command);
      }
      return;
    }

    // ── Ollama passthrough ─────────────────────────────
    setResponseText('');
    setBubbleState('visible');
    setAskStreaming(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }), signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('bad response');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResponseText(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError'))
        setResponseText('Unable to reach the model. Is Ollama running?');
    } finally {
      abortRef.current = null;
      setAskStreaming(false);
      fadeTimerRef.current = setTimeout(() => {
        setBubbleState('fading');
        setTimeout(() => { setBubbleState('idle'); setResponseText(''); }, 500);
      }, 8_000);
    }
  };

  // ── Drafting flow ─────────────────────────────────────
  const resetDraft = () => {
    setStep('idle');
    setIdeaText('');
    setRecipientName('');
    setDraftType(null);
    setEmailTo('');
  };

  const startDraft = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setBubbleState('idle');
    setResponseText('');
    setStep('idea');
  };

  const advanceFromIdea = () => {
    if (!ideaText.trim()) return;
    const name = detectName(ideaText);
    if (name) {
      setRecipientName(name);
      setStep('type');
    } else {
      setStep('recipient');
    }
  };

  const advanceFromRecipient = () => {
    // recipientName may be empty — that's fine
    setStep('type');
  };

  const selectEmail = () => {
    setDraftType('email');
    // Pre-fill emailTo with recipientName if it looks like an email, else leave for user
    setEmailTo(recipientName.includes('@') ? recipientName : '');
    setTimeout(() => emailToRef.current?.focus(), 50);
  };

  const generate = async () => {
    if (!draftType) return;
    setStep('generating');

    const recipientPart = recipientName.trim() ? ` for ${recipientName.trim()}` : '';

    const prompt = draftType === 'email'
      ? `Write three email drafts${recipientPart} about: "${ideaText.trim()}".

Use EXACTLY this format with no extra text before or after:

---DIRECT---
Subject: [subject line]

[concise, direct email body with greeting and sign-off]

---CASUAL---
Subject: [subject line]

[friendly, casual email body with greeting and sign-off]

---PROFESSIONAL---
Subject: [subject line]

[formal, professional email body with greeting and sign-off]`
      : `Write three document drafts${recipientPart} about: "${ideaText.trim()}".

Use EXACTLY this format with no extra text before or after:

---DIRECT---
[Title]

[concise, direct content with clear sections]

---CASUAL---
[Title]

[friendly, conversational content]

---PROFESSIONAL---
[Title]

[formal, professional content with structured sections]`;

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }), signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('bad response');
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError'))
        accumulated = 'Unable to generate draft. Please try again.';
    } finally {
      abortRef.current = null;
    }

    if (accumulated) {
      const versions = parseVersions(accumulated);
      const subject  = extractSubject(versions.direct) || ideaText.trim().slice(0, 60);

      const draftData = {
        type:       draftType,
        to:         draftType === 'email' ? emailTo : '',
        subject,
        content:    versions.direct,
        versions,
        activeTone: 'direct' as const,
      };
      localStorage.setItem('cadence_active_draft', JSON.stringify(draftData));
      window.dispatchEvent(new CustomEvent('cadenceDraftReady'));
      onDraftGenerated({ type: draftType, content: versions.direct });
    }
    resetDraft();
  };

  const isExpanded = step !== 'idle';

  const stepMessage =
    step === 'idea'      ? 'What do you need to write about?'     :
    step === 'recipient' ? 'Who is this for?'                     :
    step === 'type'      ? 'How would you like to deliver this?'  :
    step === 'generating'? 'Generating...'                        : '';

  return (
    <div className={styles.wrapper}>
      {/* ── Response bubble ────────────────────────────────── */}
      {bubbleState !== 'idle' && (
        <div className={`${styles.responseBubble} ${bubbleState === 'fading' ? styles.responseBubbleFading : ''}`}>
          {responseText ? responseText : <span className={styles.streamDot} />}
        </div>
      )}

      {/* ── Expanded inner box ─────────────────────────────── */}
      {isExpanded && (
        <div className={styles.innerBox}>
          <div className={styles.aiRow}>
            <div className={styles.aiIcon}><SparkIcon /></div>
            <span className={styles.aiMessage}>{stepMessage}</span>
          </div>

          {/* Type selection + email To: field */}
          {step === 'type' && (
            <>
              <div className={styles.docTypeRow}>
                <button
                  className={`${styles.docTypeBtn} ${draftType === 'email' ? styles.docTypeBtnActive : ''}`}
                  aria-label="Email"
                  onClick={selectEmail}
                ><EmailIcon /></button>
                <button
                  className={`${styles.docTypeBtn} ${draftType === 'document' ? styles.docTypeBtnActive : ''}`}
                  aria-label="Document"
                  onClick={() => { setDraftType('document'); generate(); }}
                ><DocIcon /></button>
              </div>

              {draftType === 'email' && (
                <input
                  ref={emailToRef}
                  className={styles.emailInput}
                  type="email"
                  placeholder="To (email address)"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generate(); } }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Bottom row ─────────────────────────────────────── */}
      <div className={styles.bottomRow}>
        {/* Idle */}
        {step === 'idle' && (
          <>
            <input
              className={styles.askInput}
              placeholder="Ask..."
              value={askInput}
              disabled={askStreaming}
              onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAsk(); } }}
            />
            <button className={styles.sparkBtn} aria-label="Start drafting" onClick={startDraft}>
              <SparkIcon />
            </button>
          </>
        )}

        {/* Step: idea */}
        {step === 'idea' && (
          <>
            <div className={styles.avatar} />
            <input
              className={styles.askInput}
              placeholder="e.g. coffee tomorrow, Q3 update, meeting follow-up..."
              value={ideaText}
              autoFocus
              onChange={e => setIdeaText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); advanceFromIdea(); } }}
            />
            <button
              className={styles.sparkBtn}
              disabled={!ideaText.trim()}
              onClick={advanceFromIdea}
            ><ChevronIcon /></button>
          </>
        )}

        {/* Step: recipient */}
        {step === 'recipient' && (
          <>
            <div className={styles.avatar} />
            <input
              className={styles.askInput}
              placeholder="Name or email..."
              value={recipientName}
              autoFocus
              onChange={e => setRecipientName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); advanceFromRecipient(); } }}
            />
            <button className={styles.sparkBtn} onClick={advanceFromRecipient}>
              <ChevronIcon />
            </button>
          </>
        )}

        {/* Step: type — no email selected yet */}
        {step === 'type' && !draftType && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>Email or document?...</span>
          </>
        )}

        {/* Step: type — email selected, waiting for To: */}
        {step === 'type' && draftType === 'email' && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>Add email above, then generate</span>
            <button className={styles.sparkBtn} onClick={generate}><ChevronIcon /></button>
          </>
        )}

        {/* Generating */}
        {step === 'generating' && (
          <>
            <span className={`${styles.askInput} ${styles.askInputPlaceholder} ${styles.askInputDim}`}>
              Generating...
            </span>
            <div className={`${styles.sparkBtn} ${styles.sparkBtnDim}`}><SparkIcon /></div>
          </>
        )}
      </div>
    </div>
  );
}
