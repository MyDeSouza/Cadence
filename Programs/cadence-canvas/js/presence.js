// cadence-canvas / js / presence.js
// Simulated collaborator presence — cursors, activity feed

const Presence = (() => {

  let overlay, animFrame;
  const cursors = {};         // memberId → { el, x, y }
  const CANVAS_SCALE = 6000;  // world width ref

  // ── Init ───────────────────────────────────────────────────
  function init() {
    overlay = document.getElementById('presence-overlay');
    buildTopbarPresence();
    spawnCursors();
    animateCursors();
    scheduleActivityChips();
  }

  // ── Topbar presence avatars ───────────────────────────────
  function buildTopbarPresence() {
    const container = document.querySelector('.topbar-presence');
    if (!container) return;

    MOCK.team.forEach(member => {
      const el = document.createElement('div');
      el.className = 'avatar';
      el.style.background = member.color;
      el.title = `${member.fullName} — ${member.role} (${member.state})`;
      el.innerHTML = `
        ${member.initials}
        <span class="state-dot ${member.state}"></span>
      `;
      container.appendChild(el);
    });
  }

  // ── Cursor spawning ───────────────────────────────────────
  function spawnCursors() {
    // Only active/viewing members get cursors
    const activePaths = MOCK.presencePaths.filter(p => {
      const m = MOCK.team.find(t => t.id === p.memberId);
      return m && m.state !== 'away';
    });

    activePaths.forEach(path => {
      const member = MOCK.team.find(t => t.id === path.memberId);
      if (!member) return;

      const el = document.createElement('div');
      el.className = 'presence-cursor';
      el.innerHTML = `
        <div class="presence-cursor-arrow">
          <svg class="cursor-svg" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2L17 12.5L10.5 13.5L7.5 20L4 2Z"
                  fill="${member.color}"
                  stroke="rgba(0,0,0,0.3)"
                  stroke-width="1"/>
          </svg>
        </div>
        <div class="presence-cursor-label" style="background:${member.color}">
          ${member.fullName}
        </div>
      `;

      overlay.appendChild(el);
      cursors[member.id] = { el, path, x: path.startX, y: path.startY };
    });
  }

  // ── Cursor animation ──────────────────────────────────────
  function animateCursors() {
    function tick() {
      const t = performance.now() / 1000;
      const vp = document.getElementById('canvas-viewport');
      if (!vp) { animFrame = requestAnimationFrame(tick); return; }

      Object.values(cursors).forEach(cursor => {
        const p = cursor.path;

        // Smooth orbital path with gentle drift
        const wx = p.orbitCX + Math.cos(t * p.speed + p.phase) * p.rx
                             + Math.sin(t * p.speed * 0.31 + p.phase) * p.rx * 0.2;
        const wy = p.orbitCY + Math.sin(t * p.speed * 0.7 + p.phase) * p.ry
                             + Math.cos(t * p.speed * 0.55 + p.phase) * p.ry * 0.15;

        // World → screen
        const screen = Canvas.worldToScreen(wx, wy);

        // Lerp for smooth appearance
        cursor.screenX = cursor.screenX !== undefined
          ? cursor.screenX + (screen.x - cursor.screenX) * 0.07
          : screen.x;
        cursor.screenY = cursor.screenY !== undefined
          ? cursor.screenY + (screen.y - cursor.screenY) * 0.07
          : screen.y;

        cursor.el.style.transform = `translate(${cursor.screenX}px, ${cursor.screenY}px)`;

        // Hide if off screen
        const rect = vp.getBoundingClientRect();
        const inBounds = cursor.screenX > rect.left - 40 && cursor.screenX < rect.right  + 40
                      && cursor.screenY > rect.top  - 40 && cursor.screenY < rect.bottom + 40;
        cursor.el.style.opacity = inBounds ? '1' : '0';
      });

      animFrame = requestAnimationFrame(tick);
    }

    animFrame = requestAnimationFrame(tick);
  }

  // ── Activity chips ────────────────────────────────────────
  const ACTIVITY_MESSAGES = [
    { id: 'lw', message: 'is viewing the Sprint brief' },
    { id: 'ki', message: 'pushed a commit to main' },
    { id: 'lw', message: 'left a comment in Figma' },
    { id: 'st', message: 'updated the roadmap doc' },
    { id: 'ki', message: 'merged #dev thread' },
  ];

  let chipIndex = 0;

  function scheduleActivityChips() {
    // Show first chip after 3s, then every 12s
    setTimeout(() => {
      showNextChip();
      setInterval(showNextChip, 12000);
    }, 3000);
  }

  function showNextChip() {
    const item = ACTIVITY_MESSAGES[chipIndex % ACTIVITY_MESSAGES.length];
    chipIndex++;
    const member = MOCK.team.find(t => t.id === item.id);
    if (member) showActivity(member, item.message);
  }

  function showActivity(member, message) {
    const existing = document.querySelector('.activity-chip');
    if (existing) existing.remove();

    const chip = document.createElement('div');
    chip.className = 'activity-chip';
    chip.innerHTML = `
      <div class="activity-chip-avatar" style="background:${member.color}">${member.initials}</div>
      <span class="activity-chip-text">${member.fullName} ${message}</span>
    `;

    document.body.appendChild(chip);
    setTimeout(() => chip.remove(), 4000);
  }

  // ── Clock ─────────────────────────────────────────────────
  function startClock() {
    const el = document.querySelector('.topbar-clock');
    if (!el) return;

    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      el.textContent = `${h}:${m}`;
    }

    update();
    setInterval(update, 30000);
  }

  return { init, showActivity, startClock };

})();
