import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { scoreEvent } from '../src/engine/scoring';
import { classifyEvent } from '../src/engine/classification';
import { UserPreferences, SourceWeights } from '../src/types';

const prisma = new PrismaClient();

const DEFAULT_PREFS: UserPreferences = {
  id: 'seed',
  user_id: 'default',
  source_weights: {
    google_calendar: 70,
    gmail: 60,
    manual: 90,
    webhook: 30,
    apple_calendar: 70,
  },
  keyword_boosts: ['urgent', 'deadline', 'RSVP', 'invoice', 'asap', 'critical'],
  tag_weights: { work: 20, health: 15, personal: 10, client: 25, finance: 20 },
  surface_threshold: 65,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  digest_time: '08:00',
  max_foreground_signals: 4,
};

// Seed events — mix of sources, types, urgencies, and tags
// Timestamps are relative to "now" at seed time for realistic scoring
const now = new Date();
const h = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000).toISOString();

const rawEvents = [
  {
    title: 'Q2 investor call — RSVP required',
    source: 'gmail' as const,
    type: 'email' as const,
    timestamp: h(-1),
    deadline: h(3),
    raw_content: 'Please confirm attendance for the Q2 investor update call. RSVP by EOD.',
    tags: ['work', 'client'],
  },
  {
    title: 'Submit tax invoice — urgent',
    source: 'manual' as const,
    type: 'task' as const,
    timestamp: h(0),
    deadline: h(5),
    raw_content: 'Invoice #1042 must be submitted before close of business.',
    tags: ['finance', 'work'],
  },
  {
    title: 'Team standup',
    source: 'google_calendar' as const,
    type: 'event' as const,
    timestamp: h(1),
    deadline: h(1.5),
    raw_content: 'Daily team sync — 15 mins',
    tags: ['work'],
  },
  {
    title: 'GP appointment',
    source: 'apple_calendar' as const,
    type: 'event' as const,
    timestamp: h(4),
    deadline: h(5),
    raw_content: 'Annual health check with Dr. Patel',
    tags: ['health', 'personal'],
  },
  {
    title: 'Deploy staging — critical window',
    source: 'webhook' as const,
    type: 'notification' as const,
    timestamp: h(0),
    deadline: h(1),
    raw_content: 'CI pipeline requires manual approval for staging deploy. Critical dependency.',
    tags: ['work'],
  },
  {
    title: 'Gym session',
    source: 'apple_calendar' as const,
    type: 'event' as const,
    timestamp: h(6),
    deadline: h(7.5),
    raw_content: '',
    tags: ['health', 'personal'],
  },
  {
    title: 'Client design review — deadline today',
    source: 'google_calendar' as const,
    type: 'event' as const,
    timestamp: h(2),
    deadline: h(3),
    raw_content: 'Review final design mockups with Figma. Client must approve before handoff.',
    tags: ['work', 'client'],
  },
  {
    title: 'Read newsletter',
    source: 'gmail' as const,
    type: 'email' as const,
    timestamp: h(-2),
    raw_content: 'Weekly industry digest from Stratechery.',
    tags: ['personal'],
  },
  {
    title: 'Renew software licence — invoice attached',
    source: 'gmail' as const,
    type: 'email' as const,
    timestamp: h(-3),
    deadline: h(48),
    raw_content: 'Your Figma licence expires in 2 days. Invoice attached for renewal.',
    tags: ['work', 'finance'],
  },
  {
    title: 'Slack: PR review requested asap',
    source: 'webhook' as const,
    type: 'notification' as const,
    timestamp: h(0),
    raw_content: '@you — can you review this PR asap? Blocking the release.',
    tags: ['work'],
  },
  {
    title: 'Evening walk',
    source: 'manual' as const,
    type: 'task' as const,
    timestamp: h(8),
    raw_content: '',
    tags: ['personal', 'health'],
  },
  {
    title: 'Board report draft due',
    source: 'manual' as const,
    type: 'task' as const,
    timestamp: h(0),
    deadline: h(20),
    raw_content: 'First draft of board report must be shared with exec team before tomorrow morning.',
    tags: ['work', 'client'],
  },
];

async function main() {
  console.log('Seeding database...');

  // Clear existing seed data
  await prisma.feedbackLog.deleteMany();
  await prisma.cadenceEvent.deleteMany();
  await prisma.userPreferences.deleteMany();

  // Insert default preferences
  await prisma.userPreferences.create({
    data: {
      user_id: 'default',
      source_weights: DEFAULT_PREFS.source_weights,
      keyword_boosts: DEFAULT_PREFS.keyword_boosts,
      tag_weights: DEFAULT_PREFS.tag_weights,
      surface_threshold: DEFAULT_PREFS.surface_threshold,
      quiet_hours_start: DEFAULT_PREFS.quiet_hours_start,
      quiet_hours_end: DEFAULT_PREFS.quiet_hours_end,
      digest_time: DEFAULT_PREFS.digest_time,
      max_foreground_signals: DEFAULT_PREFS.max_foreground_signals,
    },
  });

  // Score and insert events
  for (const raw of rawEvents) {
    const score = scoreEvent(raw, DEFAULT_PREFS);
    const cognitive_type = classifyEvent(
      { score, type: raw.type, timestamp: raw.timestamp, deadline: raw.deadline },
      []
    );

    const created = await prisma.cadenceEvent.create({
      data: {
        id: uuidv4(),
        title: raw.title,
        source: raw.source,
        type: raw.type,
        timestamp: new Date(raw.timestamp),
        deadline: raw.deadline ? new Date(raw.deadline) : undefined,
        raw_content: raw.raw_content || undefined,
        tags: raw.tags,
        score,
        cognitive_type,
      },
    });

    console.log(`  [${score.toFixed(1).padStart(5)}] ${cognitive_type.padEnd(16)} ${created.title}`);
  }

  console.log('\nSeed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
