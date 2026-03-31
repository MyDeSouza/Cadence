import { Router, Request, Response } from 'express';
import http from 'http';
import prisma from '../db';
import { getPreferences } from '../lib/preferences';

// ─── POST /ask ────────────────────────────────────────────────────────────────
// Accepts { message } from the frontend, builds a prompt from the user's
// current surfaced signals, and streams Ollama's response token-by-token.

const router = Router();

const OLLAMA_HOST  = 'localhost';
const OLLAMA_PORT  = 11434;
const OLLAMA_MODEL = 'mistral';

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body as { message?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  // ── Fetch forward-looking surfaced signals only ────────────────────────────
  const prefs = await getPreferences();
  const now   = new Date();

  const events = await prisma.cadenceEvent.findMany({
    where: {
      score:         { gte: prefs.surface_threshold },
      user_actioned: null,
      // Only future events — past signals have no bearing on what's next
      OR: [
        { deadline:  { gte: now } },
        { timestamp: { gte: now } },
      ],
    },
    orderBy: { timestamp: 'asc' },
  });

  // ── Build context block ────────────────────────────────────────────────────
  const contextLines = events
    .map((e, i) => {
      const due = e.deadline
        ? ` — due ${new Date(e.deadline).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`
        : ` — at ${new Date(e.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
      return `${i + 1}. "${e.title}" [${e.cognitive_type ?? 'informational'}]${due}`;
    })
    .join('\n');

  const context = contextLines.length > 0
    ? `The user's upcoming surfaced signals:\n${contextLines}\n\n`
    : `There are no upcoming surfaced signals right now.\n\n`;

  const prompt =
    `You are Cadence, a focused cognitive triage assistant. ` +
    `Respond in 2-3 sentences maximum. Be direct. No bullet points, no numbered lists, no headers — plain conversational text only.\n\n` +
    context +
    `User: ${message.trim()}\nCadence:`;

  // ── Stream Ollama response ─────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');   // disable proxy buffering (nginx etc.)
  res.flushHeaders();

  const body = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true });

  const ollamaReq = http.request(
    {
      hostname: OLLAMA_HOST,
      port:     OLLAMA_PORT,
      path:     '/api/generate',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    (ollamaRes) => {
      let buffer = '';

      ollamaRes.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        // Ollama sends one JSON object per line
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';           // keep any incomplete trailing line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as { response?: string; done?: boolean };
            if (parsed.response) res.write(parsed.response);
          } catch {
            // malformed line — skip
          }
        }
      });

      ollamaRes.on('end', () => res.end());
      ollamaRes.on('error', () => res.end());
    }
  );

  ollamaReq.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Ollama is not reachable. Make sure it is running on port 11434.' });
    } else {
      res.end();
    }
  });

  ollamaReq.write(body);
  ollamaReq.end();
});

export default router;
