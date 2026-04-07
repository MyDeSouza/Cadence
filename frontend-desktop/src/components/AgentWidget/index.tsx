import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../constants/api';
import styles from './AgentWidget.module.css';

type DraftType = 'email' | 'document';
type DraftTone = 'formal' | 'casual' | 'direct';
type Step = 'idle' | 'step1' | 'emailDetails' | 'step2' | 'step3' | 'generating';
type BubbleState = 'idle' | 'visible' | 'fading';

interface Props {
  onDraftGenerated: (draft: { type: DraftType; content: string }) => void;
}

// ── Icons ────────────────────────────────────────────────
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2L11.8 8.2L18 10L11.8 11.8L10 18L8.2 11.8L2 10L8.2 8.2L10 2Z"
        fill="white"
      />
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

// ── Main component ──────────────────────────────────────
export function AgentWidget({ onDraftGenerated }: Props) {
  // Drafting flow
  const [step,         setStep]         = useState<Step>('idle');
  const [draftType,    setDraftType]    = useState<DraftType | null>(null);
  const [tone,         setTone]         = useState<DraftTone>('casual');
  const [intent,       setIntent]       = useState('');

  // Email-specific fields
  const [to,           setTo]           = useState('');
  const [subject,      setSubject]      = useState('');
  const [toError,      setToError]      = useState(false);
  const [subjectError, setSubjectError] = useState(false);

  // Ask (direct chat) state
  const [askInput,     setAskInput]     = useState('');
  const [responseText, setResponseText] = useState('');
  const [bubbleState,  setBubbleState]  = useState<BubbleState>('idle');
  const [askStreaming,  setAskStreaming]  = useState(false);

  const abortRef     = useRef<AbortController | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subjectRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, []);

  // ── Ask / direct chat ────────────────────────────────
  const sendAsk = async () => {
    const text = askInput.trim();
    if (!text || askStreaming) return;

    setAskInput('');
    setResponseText('');
    setBubbleState('visible');
    setAskStreaming(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    const controller = new AbortController();
    abortRef.current = controller;

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
        setResponseText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setResponseText('Unable to reach the model. Is Ollama running?');
      }
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
    setDraftType(null);
    setTone('casual');
    setIntent('');
    setTo('');
    setSubject('');
    setToError(false);
    setSubjectError(false);
  };

  const startDraft = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setBubbleState('idle');
    setResponseText('');
    setStep('step1');
  };

  const advanceFromEmailDetails = () => {
    const toOk  = to.trim().length > 0;
    const subOk = subject.trim().length > 0;
    setToError(!toOk);
    setSubjectError(!subOk);
    if (toOk && subOk) setStep('step2');
  };

  const generate = async (intentText: string) => {
    if (!intentText.trim()) return;
    setStep('generating');

    const prompt = draftType === 'email'
      ? `Draft a ${tone} email to ${to} with subject "${subject}". Content request: ${intentText.trim()}.\n\nFormat:\nSubject: ${subject}\n\n[email body with appropriate greeting and sign-off]`
      : `Draft a ${tone} document. Topic: ${intentText.trim()}.\n\nInclude a clear title and organized sections.`;

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt }),
        signal:  controller.signal,
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
      if (!(err instanceof Error && err.name === 'AbortError')) {
        accumulated = 'Unable to generate draft. Please try again.';
      }
    } finally {
      abortRef.current = null;
    }

    if (accumulated) {
      // Store in localStorage so notch pen icon appears
      const draftData = {
        type:    draftType ?? 'document',
        to:      draftType === 'email' ? to      : '',
        subject: draftType === 'email' ? subject : '',
        content: accumulated,
      };
      localStorage.setItem('cadence_active_draft', JSON.stringify(draftData));
      window.dispatchEvent(new CustomEvent('cadenceDraftReady'));
      onDraftGenerated({ type: draftType ?? 'document', content: accumulated });
    }
    resetDraft();
  };

  const isExpanded = step !== 'idle';

  const stepMessage =
    step === 'step1'        ? 'What are we drafting?...'       :
    step === 'emailDetails' ? 'Who is this going to?'          :
    step === 'step2'        ? "What's the tone?"               :
    step === 'step3'        ? 'What would you like to write...' :
    step === 'generating'   ? 'Generating...'                  : '';

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

          {/* Step 1 — doc type */}
          {step === 'step1' && (
            <div className={styles.docTypeRow}>
              <button
                className={styles.docTypeBtn}
                aria-label="Email"
                onClick={() => { setDraftType('email'); setStep('emailDetails'); }}
              ><EmailIcon /></button>
              <button
                className={styles.docTypeBtn}
                aria-label="Document"
                onClick={() => { setDraftType('document'); setStep('step2'); }}
              ><DocIcon /></button>
            </div>
          )}

          {/* Email details — To + Subject */}
          {step === 'emailDetails' && (
            <div className={styles.emailDetailsRow}>
              <input
                className={`${styles.emailInput} ${toError ? styles.emailInputError : ''}`}
                type="email"
                placeholder="To"
                value={to}
                autoFocus
                onChange={(e) => { setTo(e.target.value); if (toError) setToError(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') { e.preventDefault(); subjectRef.current?.focus(); }
                  if (e.key === 'Enter') subjectRef.current?.focus();
                }}
              />
              <input
                ref={subjectRef}
                className={`${styles.emailInput} ${subjectError ? styles.emailInputError : ''}`}
                placeholder="Subject"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); if (subjectError) setSubjectError(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') advanceFromEmailDetails();
                }}
              />
            </div>
          )}

          {/* Step 2 — tone */}
          {step === 'step2' && (
            <div className={styles.toneRow}>
              {(['formal', 'casual', 'direct'] as DraftTone[]).map((t) => (
                <button
                  key={t}
                  className={`${styles.tonePill} ${tone === t ? styles.tonePillActive : ''}`}
                  onClick={() => setTone(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom row ─────────────────────────────────────── */}
      <div className={styles.bottomRow}>
        {step === 'idle' && (
          <>
            <input
              className={styles.askInput}
              placeholder="Ask..."
              value={askInput}
              disabled={askStreaming}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAsk(); }
              }}
            />
            <button className={styles.sparkBtn} aria-label="Start drafting" onClick={startDraft}>
              <SparkIcon />
            </button>
          </>
        )}

        {step === 'step1' && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>Ask...</span>
          </>
        )}

        {step === 'emailDetails' && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>Fill in details above...</span>
            <button className={styles.sparkBtn} aria-label="Next" onClick={advanceFromEmailDetails}>
              <ChevronIcon />
            </button>
          </>
        )}

        {step === 'step2' && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>
              {tone ? `${tone.charAt(0).toUpperCase() + tone.slice(1)} selected — press enter` : 'Pick a tone above...'}
            </span>
            <button
              className={styles.sparkBtn}
              disabled={!tone}
              aria-label="Next"
              onClick={() => { if (tone) setStep('step3'); }}
            ><ChevronIcon /></button>
          </>
        )}

        {step === 'step3' && (
          <>
            <div className={styles.avatar} />
            <textarea
              className={`${styles.askInput} ${styles.intentArea}`}
              placeholder={draftType === 'email'
                ? 'e.g. ask Sarah if she wants coffee next week'
                : 'e.g. notes on the Q3 review meeting...'}
              value={intent}
              autoFocus
              rows={2}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(intent); }
              }}
            />
          </>
        )}

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
