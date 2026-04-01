import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

// ─── GET /auth/revoke — delete stored Google OAuth token ─────────────────────
// Removes the google_calendar Source row for the default user, forcing
// a full re-auth on the next sync request.

router.get('/revoke', async (_req: Request, res: Response): Promise<void> => {
  await prisma.source.deleteMany({
    where: { user_id: 'default', source_type: 'google_calendar' },
  });

  res.json({ status: 'revoked' });
});

export default router;
