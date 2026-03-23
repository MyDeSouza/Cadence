import { Router, Request, Response } from 'express';
import prisma from '../db';
import { FeedbackInput } from '../types';

const router = Router();

// ─── POST /feedback — log user interaction outcome ───────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { cadence_event_id, outcome, time_to_action_ms } = req.body as FeedbackInput;

  if (!cadence_event_id || !outcome) {
    res.status(400).json({ error: 'cadence_event_id and outcome are required' });
    return;
  }

  const validOutcomes = ['actioned', 'dismissed', 'ignored'];
  if (!validOutcomes.includes(outcome)) {
    res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    return;
  }

  const event = await prisma.cadenceEvent.findUnique({ where: { id: cadence_event_id } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  // Log feedback
  const feedback = await prisma.feedbackLog.create({
    data: {
      cadence_event_id,
      outcome,
      time_to_action_ms: time_to_action_ms ?? null,
    },
  });

  // Update event's user_actioned state
  await prisma.cadenceEvent.update({
    where: { id: cadence_event_id },
    data: { user_actioned: outcome },
  });

  res.status(201).json(feedback);
});

// ─── GET /feedback — retrieve all feedback logs (useful for Phase 2 analysis) ─

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const logs = await prisma.feedbackLog.findMany({
    orderBy: { timestamp: 'desc' },
    include: { event: { select: { title: true, source: true, score: true, cognitive_type: true } } },
  });
  res.json(logs);
});

export default router;
