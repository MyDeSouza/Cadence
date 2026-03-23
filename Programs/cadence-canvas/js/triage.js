// cadence-canvas / js / triage.js
// Weighting engine + AI triage surfacing logic

// SURFACE_LOGIC — replace with live weighting engine post-API integration
const WEIGHT_CONFIG = {
  calendarProximity:    0.35,  // how soon is the next event
  taskUrgency:          0.30,  // overdue or due today
  timeOfDay:            0.20,  // morning=planning, afternoon=execution, evening=review
  collaboratorPresence: 0.15   // active teammates right now
};

const Triage = (() => {

  // ── Panel base weights (contextual, not just static) ─────
  // Computed once on init, updated on context change
  const weights = {};

  function computeWeights() {
    const now = new Date();
    const hour = now.getHours();

    // ── Calendar proximity score ──
    const nextEvent = MOCK.calendar[0];
    const minsUntil = nextEvent?.minutesUntil ?? 120;
    const calScore  = minsUntil < 15  ? 1.0
                    : minsUntil < 30  ? 0.85
                    : minsUntil < 60  ? 0.65
                    : minsUntil < 120 ? 0.40
                    : 0.20;

    // ── Task urgency score ──
    const todayTasks = MOCK.tasks.filter(t => t.due === 'Today').length;
    const taskScore  = todayTasks >= 2 ? 0.9
                     : todayTasks === 1 ? 0.65
                     : 0.3;

    // ── Time of day score ──
    // Morning (6-11): planning → calendar + tasks
    // Afternoon (11-17): execution → slack + figma
    // Evening (17-22): review → notion + triage
    const isMorning   = hour >= 6  && hour < 11;
    const isAfternoon = hour >= 11 && hour < 17;
    const isEvening   = hour >= 17 && hour < 22;

    // ── Collaborator presence ──
    const activeCount = MOCK.team.filter(m => m.state === 'active').length;
    const presScore = activeCount >= 3 ? 0.9
                    : activeCount >= 2 ? 0.7
                    : activeCount >= 1 ? 0.5
                    : 0.1;

    // ── Per-panel composite weights ──
    weights['calendar'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * calScore  +
      WEIGHT_CONFIG.taskUrgency          * 0.5       +
      WEIGHT_CONFIG.timeOfDay            * (isMorning ? 0.9 : isAfternoon ? 0.5 : 0.3) +
      WEIGHT_CONFIG.collaboratorPresence * presScore
    );

    weights['triage'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * calScore  * 0.8 +
      WEIGHT_CONFIG.taskUrgency          * taskScore * 0.7 +
      WEIGHT_CONFIG.timeOfDay            * (isEvening ? 0.9 : 0.5) +
      WEIGHT_CONFIG.collaboratorPresence * presScore * 0.6
    );

    weights['tasks'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * 0.4       +
      WEIGHT_CONFIG.taskUrgency          * taskScore +
      WEIGHT_CONFIG.timeOfDay            * (isMorning ? 0.85 : isAfternoon ? 0.7 : 0.4) +
      WEIGHT_CONFIG.collaboratorPresence * 0.3
    );

    weights['slack'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * 0.2       +
      WEIGHT_CONFIG.taskUrgency          * 0.3       +
      WEIGHT_CONFIG.timeOfDay            * (isAfternoon ? 0.9 : isMorning ? 0.5 : 0.4) +
      WEIGHT_CONFIG.collaboratorPresence * presScore
    );

    weights['notion'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * calScore * 0.9 +
      WEIGHT_CONFIG.taskUrgency          * 0.4            +
      WEIGHT_CONFIG.timeOfDay            * (isMorning ? 0.7 : isEvening ? 0.9 : 0.5) +
      WEIGHT_CONFIG.collaboratorPresence * 0.4
    );

    weights['figma'] = clamp(
      WEIGHT_CONFIG.calendarProximity    * 0.3       +
      WEIGHT_CONFIG.taskUrgency          * 0.5       +
      WEIGHT_CONFIG.timeOfDay            * (isAfternoon ? 0.85 : 0.5) +
      WEIGHT_CONFIG.collaboratorPresence * presScore * 0.7
    );
  }

  function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

  function getWeight(tool) {
    if (Object.keys(weights).length === 0) computeWeights();
    return weights[tool] ?? 0.5;
  }

  // ── Topbar context indicator ──────────────────────────────
  function updateContextIndicator() {
    const pill = document.querySelector('.topbar-context-pill');
    if (!pill) return;

    const next = MOCK.calendar[0];
    if (!next) return;

    const mins = next.minutesUntil;
    const timeStr = mins < 60
      ? `in ${mins} min`
      : `at ${next.time}`;

    pill.innerHTML = `
      <span class="dot"></span>
      <span>${next.title} ${timeStr}</span>
    `;
  }

  // ── Countdown ticker ──────────────────────────────────────
  function startCountdown() {
    let tick = 0;
    setInterval(() => {
      tick++;
      // Decrement minutesUntil every real minute (simulated faster for demo: every 20s)
      MOCK.calendar.forEach(ev => {
        if (ev.minutesUntil > 0) ev.minutesUntil = Math.max(0, ev.minutesUntil - 1);
      });
      updateContextIndicator();
    }, 60000);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    computeWeights();
    updateContextIndicator();
    startCountdown();
  }

  return { init, getWeight, computeWeights };

})();
