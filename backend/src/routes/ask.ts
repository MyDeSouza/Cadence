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
  const { message, context: canvasContext } = req.body as { message?: string; context?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  // ── Fetch forward-looking surfaced signals only ────────────────────────────
  const prefs = await getPreferences();
  const now   = new Date();

  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfTomorrow   = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

  const events = await prisma.cadenceEvent.findMany({
    where: {
      score:         { gte: prefs.surface_threshold },
      user_actioned: null,
      OR: [
        { timestamp: { gte: startOfTomorrow, lt: endOfTomorrow } },
        { deadline:  { gte: startOfTomorrow, lt: endOfTomorrow } },
      ],
    },
    orderBy: { timestamp: 'asc' },
  });

  // ── Build calendar signal block ────────────────────────────────────────────
  const calLines = events
    .map((e) => {
      const due = e.deadline
        ? `due ${new Date(e.deadline).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`
        : `at ${new Date(e.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
      return `eventId:${e.id} | "${e.title}" | ${e.cognitive_type ?? 'informational'} | ${due}`;
    })
    .join('\n');

  const calendarBlock = calLines.length > 0
    ? `Upcoming surfaced signals:\n${calLines}\n\n`
    : `No upcoming surfaced signals.\n\n`;

  // ── Canvas context block (injected by frontend) ────────────────────────────
  const canvasBlock = canvasContext?.trim()
    ? `User's current workspace:\n${canvasContext.trim()}\n\n`
    : '';

  const prompt =
    `You are Cadence, a personal workspace assistant. ` +
    `Respond in 2-3 sentences maximum. Be direct and specific — refer to actual card titles or event names when relevant. ` +
    `No bullet points, no numbered lists, no headers — plain conversational text only.\n` +
    `When you identify a scheduling conflict or want to suggest a schedule change, do not describe it in prose. ` +
    `Instead output a JSON action block in this exact format on its own line: ` +
    `ACTION:{"type":"reschedule","eventId":"<copy the value after eventId: from the context>","newStart":"ISO8601","newEnd":"ISO8601","reason":"one sentence"} ` +
    `or ACTION:{"type":"move","eventId":"<copy the value after eventId: from the context>","newStart":"ISO8601","newEnd":"ISO8601","reason":"one sentence"}. ` +
    `The eventId MUST be the exact string after "eventId:" in the context — never use the event title, a number, or any other value. ` +
    `You may output multiple ACTION blocks, one per line. After the action blocks, output nothing else.\n\n` +
    canvasBlock +
    calendarBlock +
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
