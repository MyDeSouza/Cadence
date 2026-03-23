// cadence-canvas / data / mock.js
// All simulated data for the base build.
// Replace each section with live API data via the js/api/* slots.

const MOCK = {

  user: {
    id: 'mx',
    name: 'Max',
    initials: 'MX',
    role: 'Designer',
    color: '#2D78E6'
  },

  team: [
    { id: 'lw', initials: 'LW', fullName: 'Lena W.',   role: 'PM',         color: '#7C3AED', state: 'active'  },
    { id: 'ki', initials: 'KI', fullName: 'Kai I.',    role: 'Dev',        color: '#059669', state: 'viewing' },
    { id: 'br', initials: 'BR', fullName: 'Bex R.',    role: 'Marketing',  color: '#DC2626', state: 'away'    },
    { id: 'st', initials: 'ST', fullName: 'Sam T.',    role: 'Consultant', color: '#D97706', state: 'active'  },
  ],

  // Simulated current time: 09:28 AM
  currentTime: '09:28',

  calendar: [
    {
      id: 'ev1',
      title: 'Sprint Review',
      time: '10:00',
      duration: 45,
      type: 'work',
      attendees: ['lw', 'ki', 'br'],
      minutesUntil: 32,
      agenda: 'Review sprint 12 deliverables. Discuss velocity, blockers, and next sprint scope.',
      linkedDoc: 'n1',
      linkedTask: 't1'
    },
    {
      id: 'ev2',
      title: 'Design Crit',
      time: '14:30',
      duration: 60,
      type: 'work',
      attendees: ['lw', 'st'],
      minutesUntil: 302,
      agenda: 'Canvas flow and onboarding screens critique session.',
      linkedDoc: null,
      linkedTask: null
    },
    {
      id: 'ev3',
      title: 'Stakeholder Sync',
      time: '16:00',
      duration: 30,
      type: 'work',
      attendees: ['st', 'br'],
      minutesUntil: 392,
      agenda: 'Q2 roadmap alignment and sign-off.',
      linkedDoc: null,
      linkedTask: 't3'
    },
  ],

  tasks: [
    { id: 't1', title: 'Finalise onboarding flow', assignee: 'mx', due: 'Today',    status: 'In progress', priority: 'high',   project: 'Cadence', linkedEvent: 'ev1' },
    { id: 't2', title: 'API slot — Calendar',      assignee: 'ki', due: 'Tomorrow', status: 'To do',       priority: 'medium', project: 'Cadence', linkedEvent: null  },
    { id: 't3', title: 'Copy review — landing',    assignee: 'br', due: 'Today',    status: 'Review',      priority: 'high',   project: 'Cadence', linkedEvent: 'ev3' },
  ],

  slack: [
    { id: 's1', channel: '#design',  sender: 'lw', message: 'Canvas flow looking sharp — ready for review?',  time: '9:42 AM',  unread: true  },
    { id: 's2', channel: '#dev',     sender: 'ki', message: 'API slots scaffolded, waiting on token setup',   time: '10:11 AM', unread: true  },
    { id: 's3', channel: '#general', sender: 'br', message: 'Landing copy draft is up for review in Notion',  time: '10:33 AM', unread: false },
  ],

  notion: {
    id: 'n1',
    title: 'Sprint 12 Brief',
    lastEdited: '10 min ago',
    editedBy: 'lw',
    excerpt: 'Scope: Cadence canvas v1 — spatial panel layout, presence layer, triage flow. Delivery: Friday EOD.',
    collaborators: ['lw', 'ki'],
    linkedEvent: 'ev1'
  },

  figma: {
    id: 'f1',
    title: 'Cadence — Canvas v1',
    lastModified: '2 hours ago',
    activeCollaborators: ['lw', 'mx'],
    frameCount: 24,
    project: 'Cadence'
  },

  triage: [
    {
      id: 'tr1',
      type: 'ai',
      icon: '◆',
      message: 'Sprint Review in 32 min — brief and task list are surfaced. You\'re set.',
      action: 'acknowledge',
      priority: 'high',
      weight: 0.91
    },
    {
      id: 'tr2',
      type: 'collaborator',
      from: 'lw',
      icon: null,
      message: 'Updated the Sprint 12 brief — needs your approval before sharing with stakeholders.',
      action: 'approve',
      priority: 'medium',
      weight: 0.74
    },
    {
      id: 'tr3',
      type: 'ai',
      icon: '◆',
      message: 'Lena and Sam are both active now — good window to async on the landing copy before 10:00.',
      action: 'acknowledge',
      priority: 'low',
      weight: 0.52
    },
  ],

  // Simulated cursor paths for presence animation
  presencePaths: [
    { memberId: 'lw', startX: 520, startY: 280, orbitCX: 440, orbitCY: 340, rx: 120, ry: 60, speed: 0.28, phase: 0      },
    { memberId: 'ki', startX: 880, startY: 420, orbitCX: 940, orbitCY: 380, rx: 90,  ry: 50, speed: 0.19, phase: 2.1    },
    { memberId: 'st', startX: 700, startY: 620, orbitCX: 740, orbitCY: 660, rx: 110, ry: 45, speed: 0.35, phase: 4.2    },
  ]

};
