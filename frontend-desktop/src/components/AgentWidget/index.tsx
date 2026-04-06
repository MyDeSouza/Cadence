import { useState, useRef } from 'react';
import { API_BASE } from '../../constants/api';
import styles from './AgentWidget.module.css';

type DraftType = 'email' | 'document';
type DraftTone = 'formal' | 'casual' | 'direct';
type Step = 'idle' | 'step1' | 'step2' | 'step3' | 'generating';

interface DraftCard {
  id:      string;
  type:    DraftType;
  content: string;
  x:       number;
  y:       number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

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
      <path
        d="M5 2h7l4 4v13H5V2z"
        stroke="white" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M12 2v4h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7" y1="11" x2="13" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7" y1="14" x2="11" y2="14" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Draft card component ────────────────────────────────
function DraftCardEl({
  card,
  onMouseDown,
  onClose,
}: {
  card:        DraftCard;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose:     () => void;
}) {
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(card.content);
  };

  const exportDoc = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const escaped = card.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>Draft</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;line-height:1.7;color:#111;font-size:15px;}pre{white-space:pre-wrap;font-family:inherit;}</style>
</head><body><pre>${escaped}</pre><script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div
      className={styles.draftCard}
      style={{ left: card.x, top: card.y }}
      onMouseDown={onMouseDown}
    >
      <div className={styles.draftCardHeader}>
        <span className={styles.draftCardType}>
          {card.type === 'email' ? 'Email Draft' : 'Document Draft'}
        </span>
        <button className={styles.draftCardClose} onClick={onClose} aria-label="Close draft">×</button>
      </div>
      <div className={styles.draftCardContent}>{card.content}</div>
      <div className={styles.draftCardActions}>
        {card.type === 'email' ? (
          <button className={styles.draftCardAction} onClick={copyToClipboard}>
            Send
          </button>
        ) : (
          <button className={styles.draftCardAction} onClick={exportDoc}>
            Export
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AgentWidget(_props: Props) {
  const [step,       setStep]       = useState<Step>('idle');
  const [draftType,  setDraftType]  = useState<DraftType | null>(null);
  const [tone,       setTone]       = useState<DraftTone>('casual');
  const [context,    setContext]    = useState('');
  const [intent,     setIntent]     = useState('');
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const abortRef     = useRef<AbortController | null>(null);
  const dragCardRef  = useRef<{
    id: string; startX: number; startY: number; originX: number; originY: number;
  } | null>(null);

  const reset = () => {
    setStep('idle');
    setDraftType(null);
    setTone('casual');
    setContext('');
    setIntent('');
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
      const newCard: DraftCard = {
        id:      `draft-${Date.now()}`,
        type:    draftType ?? 'document',
        content: accumulated,
        x:       80,
        y:       Math.max(40, window.innerHeight / 2 - 200),
      };
      setDraftCards((prev) => [...prev, newCard]);
    }
    reset();
  };

  const onCardMouseDown = (e: React.MouseEvent, card: DraftCard) => {
    e.preventDefault();
    dragCardRef.current = {
      id: card.id, startX: e.clientX, startY: e.clientY,
      originX: card.x, originY: card.y,
    };
    const onMove = (me: MouseEvent) => {
      if (!dragCardRef.current) return;
      const dx = me.clientX - dragCardRef.current.startX;
      const dy = me.clientY - dragCardRef.current.startY;
      setDraftCards((prev) =>
        prev.map((c) =>
          c.id === dragCardRef.current!.id
            ? { ...c, x: dragCardRef.current!.originX + dx, y: dragCardRef.current!.originY + dy }
            : c
        )
      );
    };
    const onUp = () => {
      dragCardRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const removeCard = (id: string) =>
    setDraftCards((prev) => prev.filter((c) => c.id !== id));

  const isExpanded = step !== 'idle';

  const stepMessage =
    step === 'step1'      ? 'What are we drafting?...' :
    step === 'step2'      ? "Who's the audience and what's the tone?" :
    step === 'step3'      ? 'What would you like to write...' :
    step === 'generating' ? 'Generating...' : '';

  return (
    <>
      {/* ── Draft cards on canvas ──────────────────────────── */}
      {draftCards.map((card) => (
        <DraftCardEl
          key={card.id}
          card={card}
          onMouseDown={(e) => onCardMouseDown(e, card)}
          onClose={() => removeCard(card.id)}
        />
      ))}

      {/* ── Agent bar ──────────────────────────────────────── */}
      <div className={styles.wrapper}>

        {/* Expanded inner box — grows upward */}
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

        {/* ── Bottom row — always visible ─────────────────── */}
        <div className={styles.bottomRow}>
          {/* IDLE */}
          {step === 'idle' && (
            <>
              <span className={styles.placeholder}>Ask...</span>
              <button
                className={styles.sparkBtn}
                aria-label="Start drafting"
                onClick={() => setStep('step1')}
              >
                <SparkIcon />
              </button>
            </>
          )}

          {/* STEP 1 — no input yet, just show avatar + placeholder */}
          {step === 'step1' && (
            <>
              <div className={styles.avatar} />
              <span className={`${styles.inputField} ${styles.inputPlaceholder}`}>Ask...</span>
            </>
          )}

          {/* STEP 2 — audience/context input */}
          {step === 'step2' && (
            <>
              <div className={styles.avatar} />
              <input
                className={styles.inputField}
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

          {/* STEP 3 — write intent (tall textarea) */}
          {step === 'step3' && (
            <>
              <div className={styles.avatar} />
              <textarea
                className={`${styles.inputField} ${styles.intentArea}`}
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
              <span className={`${styles.placeholder} ${styles.placeholderDim}`}>
                What are we drafting?...
              </span>
              <div className={`${styles.sparkBtn} ${styles.sparkBtnDim}`}>
                <SparkIcon />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
