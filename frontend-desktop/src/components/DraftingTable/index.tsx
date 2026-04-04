import { useState, useRef } from 'react';
import type { Theme } from '../../hooks/useAdaptiveTheme';
import { API_BASE } from '../../constants/api';
import styles from './DraftingTable.module.css';

type DraftType = 'email' | 'document';
type DraftTone = 'formal' | 'casual' | 'direct';
type DraftStep = 'type' | 'details' | 'idea' | 'generating' | 'draft';

interface Props {
  theme:   Theme;
  onClose: () => void;
}

function parseDraftContent(content: string): { subject: string; body: string } {
  const match = content.match(/^subject:\s*(.+)/im);
  if (match && match.index !== undefined) {
    const subject   = match[1].trim();
    const afterLine = content.slice(match.index + match[0].length);
    const body      = afterLine.replace(/^\r?\n/, '').trim();
    return { subject, body };
  }
  return { subject: '', body: content.trim() };
}

export function DraftingTable({ theme, onClose }: Props) {
  const [step,       setStep]       = useState<DraftStep>('type');
  const [draftType,  setDraftType]  = useState<DraftType | null>(null);
  const [recipient,  setRecipient]  = useState('');
  const [tone,       setTone]       = useState<DraftTone>('casual');
  const [idea,       setIdea]       = useState('');
  const [draft,      setDraft]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sendError,  setSendError]  = useState('');
  const [copied,     setCopied]     = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const t = theme; // shorthand for CSS module class keys

  const selectType = (type: DraftType) => {
    setDraftType(type);
    setStep('details');
  };

  const goToIdea = () => {
    if (draftType === 'email' && !recipient.trim()) return;
    setStep('idea');
  };

  const generate = async () => {
    if (!idea.trim()) return;
    setStep('generating');
    setDraft('');

    const prompt = draftType === 'email'
      ? `Draft a ${tone} email to ${recipient.trim() || 'the recipient'} about: ${idea.trim()}.\n\nFormat your response as:\nSubject: [subject line]\n\n[email body with appropriate greeting and sign-off]`
      : `Draft a ${tone} document about: ${idea.trim()}.\n\nInclude a clear title, a brief introduction, and organized sections. Write in flowing prose.`;

    const controller  = new AbortController();
    abortRef.current  = controller;

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
      setStep('draft');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setDraft(accumulated);
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setDraft('Unable to generate draft. Please try again.');
        setStep('draft');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const sendEmail = async () => {
    if (sending) return;
    setSending(true);
    setSendStatus('idle');
    setSendError('');
    const { subject, body } = parseDraftContent(draft);
    try {
      const res  = await fetch(`${API_BASE}/send-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:      recipient.trim(),
          subject: subject || '(no subject)',
          body:    body || draft,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Send failed');
      setSendStatus('success');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
      setSendStatus('error');
    } finally {
      setSending(false);
    }
  };

  const saveDraft = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const escaped = draft.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>Draft</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 48px auto; line-height: 1.7; color: #111; font-size: 15px; }
  pre  { white-space: pre-wrap; font-family: inherit; }
</style></head><body><pre>${escaped}</pre>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    win.document.close();
  };

  const reset = () => {
    setStep('type');
    setDraftType(null);
    setRecipient('');
    setTone('casual');
    setIdea('');
    setDraft('');
    setSendStatus('idle');
    setSendError('');
    setCopied(false);
  };

  return (
    <div className={`${styles.panel} ${styles[`panel_${t}`]}`}>
      {/* Header */}
      <div className={`${styles.header} ${styles[`header_${t}`]}`}>
        <span className={`${styles.headerTitle} ${styles[`headerTitle_${t}`]}`}>
          Drafting Table
        </span>
        <div className={styles.headerActions}>
          {step !== 'type' && (
            <button
              className={`${styles.resetBtn} ${styles[`resetBtn_${t}`]}`}
              onClick={reset}
              aria-label="Start over"
              title="Start over"
            >
              ↺
            </button>
          )}
          <button
            className={`${styles.closeBtn} ${styles[`closeBtn_${t}`]}`}
            onClick={onClose}
            aria-label="Close drafting table"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Step: type ── */}
      {step === 'type' && (
        <div className={styles.stepBody}>
          <p className={`${styles.question} ${styles[`question_${t}`]}`}>
            What are you drafting?
          </p>
          <div className={styles.typeRow}>
            <button
              className={`${styles.typeBtn} ${styles[`typeBtn_${t}`]}`}
              onClick={() => selectType('email')}
            >
              <span className={styles.typeBtnIcon}>✉</span>
              Email
            </button>
            <button
              className={`${styles.typeBtn} ${styles[`typeBtn_${t}`]}`}
              onClick={() => selectType('document')}
            >
              <span className={styles.typeBtnIcon}>📄</span>
              Document
            </button>
          </div>
        </div>
      )}

      {/* ── Step: details ── */}
      {step === 'details' && (
        <div className={styles.stepBody}>
          <p className={`${styles.question} ${styles[`question_${t}`]}`}>
            {draftType === 'email'
              ? 'Who is it for, and what\'s the tone?'
              : 'What\'s the audience and tone?'}
          </p>

          {draftType === 'email' && (
            <input
              className={`${styles.field} ${styles[`field_${t}`]}`}
              placeholder="To (name or email)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goToIdea(); }}
              autoFocus
            />
          )}

          {draftType === 'document' && (
            <input
              className={`${styles.field} ${styles[`field_${t}`]}`}
              placeholder="Audience or context (optional)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goToIdea(); }}
              autoFocus
            />
          )}

          <div className={styles.tonePills}>
            {(['formal', 'casual', 'direct'] as DraftTone[]).map((t2) => (
              <button
                key={t2}
                className={`${styles.tonePill} ${styles[`tonePill_${t}`]} ${tone === t2 ? styles.tonePillActive : ''}`}
                onClick={() => setTone(t2)}
              >
                {t2.charAt(0).toUpperCase() + t2.slice(1)}
              </button>
            ))}
          </div>

          <button
            className={`${styles.nextBtn} ${styles[`nextBtn_${t}`]}`}
            onClick={goToIdea}
            disabled={draftType === 'email' && !recipient.trim()}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Step: idea ── */}
      {step === 'idea' && (
        <div className={styles.stepBody}>
          <p className={`${styles.question} ${styles[`question_${t}`]}`}>
            What do you want to say?
          </p>
          <textarea
            className={`${styles.ideaArea} ${styles[`ideaArea_${t}`]}`}
            placeholder={
              draftType === 'email'
                ? 'e.g. ask if she wants to grab coffee next week'
                : 'e.g. notes on the Q3 review meeting'
            }
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            autoFocus
          />
          <button
            className={`${styles.nextBtn} ${styles[`nextBtn_${t}`]}`}
            onClick={generate}
            disabled={!idea.trim()}
          >
            Generate draft
          </button>
        </div>
      )}

      {/* ── Step: generating ── */}
      {step === 'generating' && (
        <div className={styles.generatingBody}>
          <span className={`${styles.generatingDot} ${styles[`generatingDot_${t}`]}`} />
          <span className={`${styles.generatingLabel} ${styles[`generatingLabel_${t}`]}`}>
            Drafting…
          </span>
        </div>
      )}

      {/* ── Step: draft ── */}
      {step === 'draft' && (
        <div className={styles.draftBody}>
          <textarea
            className={`${styles.draftArea} ${styles[`draftArea_${t}`]}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            spellCheck
          />

          {sendStatus === 'success' && (
            <div className={`${styles.statusMsg} ${styles.statusSuccess}`}>
              ✓ Sent
            </div>
          )}
          {sendStatus === 'error' && sendError && (
            <div className={`${styles.statusMsg} ${styles.statusError}`}>
              {sendError}
            </div>
          )}

          <div className={styles.actionRow}>
            {draftType === 'email' ? (
              <>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles[`actionBtnPrimary_${t}`]}`}
                  onClick={sendEmail}
                  disabled={sending || sendStatus === 'success'}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
                <button
                  className={`${styles.actionBtn} ${styles[`actionBtnSecondary_${t}`]}`}
                  onClick={saveDraft}
                >
                  {copied ? '✓ Copied' : 'Save Draft'}
                </button>
              </>
            ) : (
              <>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles[`actionBtnPrimary_${t}`]}`}
                  onClick={exportPdf}
                >
                  Export as PDF
                </button>
                <button
                  className={`${styles.actionBtn} ${styles[`actionBtnSecondary_${t}`]}`}
                  onClick={saveDraft}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
