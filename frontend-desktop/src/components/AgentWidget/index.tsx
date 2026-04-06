import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../constants/api';
import styles from './AgentWidget.module.css';

type DraftType = 'email' | 'document';
type DraftTone = 'formal' | 'casual' | 'direct';
type Step = 'idle' | 'step1' | 'step2' | 'step3' | 'generating';
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

// ── Main component ──────────────────────────────────────
export function AgentWidget({ onDraftGenerated }: Props) {
  // Drafting flow
  const [step,      setStep]      = useState<Step>('idle');
  const [draftType, setDraftType] = useState<DraftType | null>(null);
  const [tone,      setTone]      = useState<DraftTone>('casual');
  const [context,   setContext]   = useState('');
  const [intent,    setIntent]    = useState('');

  // Ask (direct chat) state
  const [askInput,     setAskInput]     = useState('');
  const [responseText, setResponseText] = useState('');
  const [bubbleState,  setBubbleState]  = useState<BubbleState>('idle');
  const [askStreaming,  setAskStreaming]  = useState(false);

  const abortRef    = useRef<AbortController | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
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
      // Fade out after 8 seconds
      fadeTimerRef.current = setTimeout(() => {
        setBubbleState('fading');
        setTimeout(() => {
          setBubbleState('idle');
          setResponseText('');
        }, 500);
      }, 8_000);
    }
  };

  // ── Drafting flow ─────────────────────────────────────
  const resetDraft = () => {
    setStep('idle');
    setDraftType(null);
    setTone('casual');
    setContext('');
    setIntent('');
  };

  const startDraft = () => {
    // Clear any visible ask bubble when entering drafting mode
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setBubbleState('idle');
    setResponseText('');
    setStep('step1');
  };

  const generate = async (intentText: string) => {
    if (!intentText.trim()) return;
    setStep('generating');

    const audienceClause = context.trim() ? ` for ${context.trim()}` : '';
    const prompt = draftType === 'email'
      ? `Draft a ${tone} email${audienceClause} about: ${intentText.trim()}.\n\nFormat your response as:\nSubject: [subject line]\n\n[email body with appropriate greeting and sign-off]`
      : `Draft a ${tone} document${audienceClause} about: ${intentText.trim()}.\n\nInclude a clear title and organized sections.`;

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
      onDraftGenerated({ type: draftType ?? 'document', content: accumulated });
    }
    resetDraft();
  };

  const isExpanded = step !== 'idle';

  const stepMessage =
    step === 'step1'      ? 'What are we drafting?...' :
    step === 'step2'      ? "Who's the audience and what's the tone?" :
    step === 'step3'      ? 'What would you like to write...' :
    step === 'generating' ? 'Generating...' : '';

  return (
    <div className={styles.wrapper}>
      {/* ── Response bubble (appears above bar) ───────────── */}
      {bubbleState !== 'idle' && (
        <div className={`${styles.responseBubble} ${bubbleState === 'fading' ? styles.responseBubbleFading : ''}`}>
          {responseText
            ? responseText
            : <span className={styles.streamDot} />
          }
        </div>
      )}

      {/* ── Expanded inner box ─────────────────────────────── */}
      {isExpanded && (
        <div className={styles.innerBox}>
          {/* AI icon + message row */}
          <div className={styles.aiRow}>
            <div className={styles.aiIcon}><SparkIcon /></div>
            <span className={styles.aiMessage}>{stepMessage}</span>
          </div>

          {/* Step 1 — doc type buttons */}
          {step === 'step1' && (
            <div className={styles.docTypeRow}>
              <button
                className={styles.docTypeBtn}
                aria-label="Email"
                onClick={() => { setDraftType('email'); setStep('step2'); }}
              >
                <EmailIcon />
              </button>
              <button
                className={styles.docTypeBtn}
                aria-label="Document"
                onClick={() => { setDraftType('document'); setStep('step2'); }}
              >
                <DocIcon />
              </button>
            </div>
          )}

          {/* Step 2 — tone chips */}
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

      {/* ── Bottom row — always visible ─────────────────────── */}
      <div className={styles.bottomRow}>
        {/* IDLE — real input wired to Ollama */}
        {step === 'idle' && (
          <>
            <input
              className={styles.askInput}
              placeholder="Ask..."
              value={askInput}
              disabled={askStreaming}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendAsk();
                }
              }}
            />
            <button
              className={styles.sparkBtn}
              aria-label="Start drafting"
              onClick={startDraft}
            >
              <SparkIcon />
            </button>
          </>
        )}

        {/* STEP 1 — avatar + placeholder while choosing type */}
        {step === 'step1' && (
          <>
            <div className={styles.avatar} />
            <span className={`${styles.askInput} ${styles.askInputPlaceholder}`}>Ask...</span>
          </>
        )}

        {/* STEP 2 — audience/context input */}
        {step === 'step2' && (
          <>
            <div className={styles.avatar} />
            <input
              className={styles.askInput}
              placeholder="Audience or Context (Optional)..."
              value={context}
              autoFocus
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); setStep('step3'); }
              }}
            />
          </>
        )}

        {/* STEP 3 — write intent */}
        {step === 'step3' && (
          <>
            <div className={styles.avatar} />
            <textarea
              className={`${styles.askInput} ${styles.intentArea}`}
              placeholder="e.g. notes on the gate 6 presentation..."
              value={intent}
              autoFocus
              rows={2}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  generate(intent);
                }
              }}
            />
          </>
        )}

        {/* GENERATING */}
        {step === 'generating' && (
          <>
            <span className={`${styles.askInput} ${styles.askInputPlaceholder} ${styles.askInputDim}`}>
              What are we drafting?...
            </span>
            <div className={`${styles.sparkBtn} ${styles.sparkBtnDim}`}>
              <SparkIcon />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
