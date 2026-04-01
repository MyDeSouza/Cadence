import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import eventsRouter from './routes/events';
import preferencesRouter from './routes/preferences';
import digestRouter from './routes/digest';
import feedbackRouter from './routes/feedback';
import syncRouter from './routes/sync';
import microsoftSyncRouter from './routes/microsoft-sync';
import askRouter from './routes/ask';
import searchRouter from './routes/search';
import sendEmailRouter from './routes/send-email';
import authRouter from './routes/auth';
import planTomorrowRouter from './routes/plan-tomorrow';
import applyActionRouter from './routes/apply-action';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/events', eventsRouter);
app.use('/preferences', preferencesRouter);
app.use('/digest', digestRouter);
app.use('/feedback', feedbackRouter);
app.use('/sync', syncRouter);
app.use('/sync/microsoft', microsoftSyncRouter);
app.use('/ask', askRouter);
app.use('/search', searchRouter);
app.use('/send-email', sendEmailRouter);
app.use('/auth', authRouter);
app.use('/plan-tomorrow', planTomorrowRouter);
app.use('/apply-action', applyActionRouter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cadence-backend', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Cadence backend running on http://localhost:${PORT}`);
});

export default app;
