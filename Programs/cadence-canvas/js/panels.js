// cadence-canvas / js / panels.js
// Panel factory, drag/resize, context lines, surfacing logic

const Panels = (() => {

  // ── Panel registry ────────────────────────────────────────
  const registry = {};   // id → { el, x, y, w, h, tool }

  // ── Initial layout ─────────────────────────────────────── */
  // Arranged around centroid ~(760, 560)
  const INITIAL_LAYOUT = [
    { id: 'calendar', tool: 'calendar', x: 80,  y: 120, w: 320, h: 420 },
    { id: 'triage',   tool: 'triage',   x: 440, y: 120, w: 320, h: 420 },
    { id: 'tasks',    tool: 'tasks',    x: 800, y: 120, w: 320, h: 420 },
    { id: 'slack',    tool: 'slack',    x: 80,  y: 600, w: 320, h: 320 },
    { id: 'notion',   tool: 'notion',   x: 440, y: 600, w: 320, h: 320 },
    { id: 'figma',    tool: 'figma',    x: 800, y: 600, w: 320, h: 320 },
  ];

  // Context connections between panels
  const CONNECTIONS = [
    { from: 'calendar', to: 'notion' },
    { from: 'calendar', to: 'tasks'  },
    { from: 'slack',    to: 'notion' },
    { from: 'triage',   to: 'tasks'  },
  ];

  let world, svgEl;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    world = document.getElementById('canvas-world');
    svgEl = document.getElementById('context-lines-svg');

    // Surface panels in weighted order with staggered animation
    const sorted = [...INITIAL_LAYOUT].sort((a, b) => {
      const wa = Triage.getWeight(a.tool);
      const wb = Triage.getWeight(b.tool);
      return wb - wa;
    });

    sorted.forEach((cfg, i) => {
      setTimeout(() => {
        const el = createPanel(cfg);
        world.appendChild(el);
        registry[cfg.id] = { el, x: cfg.x, y: cfg.y, w: cfg.w, h: cfg.h, tool: cfg.tool };
        positionPanel(cfg.id);
        el.classList.add('appearing');
        el.addEventListener('animationend', () => el.classList.remove('appearing'), { once: true });
        drawContextLines();
      }, i * 90);
    });

    // Refresh minimap dots
    setTimeout(drawMinimapDots, 700);
  }

  // ── Panel factory ─────────────────────────────────────────
  function createPanel(cfg) {
    const el = document.createElement('div');
    el.className = 'panel';
    el.dataset.tool = cfg.tool;
    el.dataset.id   = cfg.id;
    el.style.width  = cfg.w + 'px';
    el.style.height = cfg.h + 'px';

    const weight = Triage.getWeight(cfg.tool);

    el.innerHTML = `
      <div class="panel-handle">
        <div class="panel-icon">${panelIcon(cfg.tool)}</div>
        <span class="panel-name">${panelName(cfg.tool)}</span>
        <span class="panel-weight-badge">${(weight * 100).toFixed(0)}%</span>
        <div class="panel-actions">
          <button class="panel-action-btn" data-action="pin"      title="Pin panel">⊕</button>
          <button class="panel-action-btn" data-action="minimise" title="Minimise">−</button>
        </div>
      </div>
      <div class="panel-body">
        ${renderPanelBody(cfg.tool)}
      </div>
      <div class="panel-footer">
        <span class="api-slot-indicator">${apiSlotLabel(cfg.tool)}</span>
      </div>
      <div class="resize-handle" data-resize="${cfg.id}"></div>
    `;

    bindPanelEvents(el, cfg.id);
    return el;
  }

  // ── Panel content renderers ───────────────────────────────
  function renderPanelBody(tool) {
    switch (tool) {
      case 'calendar': return renderCalendar();
      case 'triage':   return renderTriage();
      case 'tasks':    return renderTasks();
      case 'slack':    return renderSlack();
      case 'notion':   return renderNotion();
      case 'figma':    return renderFigma();
      default:         return '';
    }
  }

  function renderCalendar() {
    const events = MOCK.calendar;
    const countdownPct = Math.min(100, 100 - (events[0].minutesUntil / 60) * 100);

    let html = `
      <div class="countdown-bar">
        <div class="countdown-fill" style="width:${countdownPct}%"></div>
      </div>
      <div class="calendar-events">
    `;

    events.forEach((ev, i) => {
      const attendees = ev.attendees.map(id => {
        const m = MOCK.team.find(t => t.id === id);
        return m ? `<div class="mini-avatar" style="background:${m.color}">${m.initials}</div>` : '';
      }).join('');

      const isNext = i === 0;
      const countdownStr = isNext ? `in ${ev.minutesUntil} min` : '';

      const linkedChips = [
        ev.linkedDoc  ? `<span class="event-link-chip">📄 ${MOCK.notion.title}</span>` : '',
        ev.linkedTask ? `<span class="event-link-chip">✓ ${MOCK.tasks.find(t=>t.id===ev.linkedTask)?.title || ''}</span>` : ''
      ].filter(Boolean).join('');

      html += `
        <div class="calendar-event${isNext ? ' is-next' : ''}" data-event="${ev.id}">
          <div class="calendar-event-header">
            <span class="calendar-event-title">${ev.title}</span>
            <span class="calendar-event-time">${ev.time}${countdownStr ? ` <span style="color:var(--c3);font-size:10px">${countdownStr}</span>` : ''}</span>
          </div>
          <div class="calendar-event-meta">
            <span class="calendar-event-duration">${ev.duration} min</span>
            <span class="calendar-event-type event-type-${ev.type}">${ev.type}</span>
            <div class="avatar-stack">${attendees}</div>
          </div>
          <div class="calendar-event-expanded">
            <p class="calendar-event-agenda">${ev.agenda}</p>
            <div class="calendar-event-links">${linkedChips}</div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function renderTriage() {
    const cards = MOCK.triage;
    let html = `<div class="triage-list">`;

    cards.forEach(card => {
      const isAI = card.type === 'ai';
      const fromMember = isAI ? null : MOCK.team.find(t => t.id === card.from);

      const fromEl = isAI
        ? `<div class="triage-from-ai">◆</div><span class="triage-from-name">Cadence</span>`
        : `<div class="triage-from-avatar" style="background:${fromMember?.color}">${fromMember?.initials}</div>
           <span class="triage-from-name">${fromMember?.fullName}</span>`;

      const actionBtns = card.action === 'approve'
        ? `<button class="triage-btn approve" data-card="${card.id}" data-dir="right">✓ Approve</button>
           <button class="triage-btn defer"   data-card="${card.id}" data-dir="left">↩ Defer</button>`
        : `<button class="triage-btn acknowledge" data-card="${card.id}" data-dir="right">Got it</button>`;

      html += `
        <div class="triage-card" data-card="${card.id}">
          <div class="triage-card-body">
            <div class="triage-card-header">
              <div class="triage-card-from">${fromEl}</div>
              <div class="triage-priority ${card.priority}"></div>
            </div>
            <p class="triage-message">${card.message}</p>
            <div class="triage-actions">${actionBtns}</div>
          </div>
          <div class="triage-card-hint">
            <span class="triage-hint-text">← defer</span>
            <span class="triage-hint-text">approve →</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function renderTasks() {
    let html = `<div class="task-list">`;

    MOCK.tasks.forEach(task => {
      const assignee = task.assignee === 'mx'
        ? MOCK.user
        : MOCK.team.find(t => t.id === task.assignee) || { initials: task.assignee, color: '#888' };

      const statusClass = {
        'To do': 'status-todo',
        'In progress': 'status-inprogress',
        'Review': 'status-review',
        'Done': 'status-done',
      }[task.status] || 'status-todo';

      html += `
        <div class="task-item priority-${task.priority}" data-task="${task.id}">
          <div class="task-check"></div>
          <div class="task-content">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
              <span class="priority-dot"></span>
              <span class="task-due${task.due === 'Today' ? ' today' : ''}">${task.due}</span>
              <span class="task-status ${statusClass}">${task.status}</span>
            </div>
          </div>
          <div class="task-assignee" style="background:${assignee.color}" title="${assignee.fullName || assignee.name}">
            ${assignee.initials}
          </div>
          <div class="task-swipe-hint">✓ Done</div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function renderSlack() {
    const threads = MOCK.slack;
    let html = `<div class="slack-threads">`;

    threads.forEach((thread, i) => {
      const sender = MOCK.team.find(t => t.id === thread.sender);
      html += `
        <div class="slack-thread" data-slack="${thread.id}">
          <div class="slack-thread-header">
            ${thread.unread ? `<div class="slack-unread-dot"></div>` : ''}
            <span class="slack-channel"><strong>${thread.channel}</strong></span>
            <span class="slack-time">${thread.time}</span>
          </div>
          <div class="slack-message-row">
            <div class="slack-sender-avatar" style="background:${sender?.color}">${sender?.initials}</div>
            <p class="slack-message-text">${thread.message}</p>
          </div>
        </div>
      `;
    });

    html += `</div>
      <div class="slack-reply-row">
        <input class="slack-reply-input" placeholder="Reply in #design..." />
        <button class="slack-send-btn">↑</button>
      </div>
    `;
    return html;
  }

  function renderNotion() {
    const doc = MOCK.notion;
    const editedBy = MOCK.team.find(t => t.id === doc.editedBy);
    const collaborators = doc.collaborators.map(id => {
      const m = MOCK.team.find(t => t.id === id);
      return m ? `<div class="mini-avatar" style="background:${m.color}">${m.initials}</div>` : '';
    }).join('');

    return `
      <div class="notion-doc">
        <div class="notion-doc-header">
          <span class="notion-doc-title">${doc.title}</span>
          <span class="notion-doc-badge">Linked doc</span>
        </div>
        <div class="notion-doc-meta">
          <div class="avatar-stack">${collaborators}</div>
          <span class="notion-doc-edit-info">Edited ${doc.lastEdited} by ${editedBy?.fullName || doc.editedBy}</span>
        </div>
        <blockquote class="notion-doc-excerpt">${doc.excerpt}</blockquote>
        <button class="notion-open-btn">Open in canvas ↗</button>
      </div>
    `;
  }

  function renderFigma() {
    const file = MOCK.figma;
    const collabs = file.activeCollaborators.map(id => {
      const m = id === 'mx' ? MOCK.user : MOCK.team.find(t => t.id === id);
      return m ? `<div class="mini-avatar" style="background:${m.color}">${m.initials}</div>` : '';
    }).join('');

    const frames = Array(6).fill(0).map((_, i) =>
      `<div class="figma-mock-frame"></div>`
    ).join('');

    return `
      <div class="figma-preview">
        <div class="figma-frame-grid">${frames}</div>
        <div class="figma-overlay-info">
          <span class="figma-file-name">${file.title}</span>
          <span class="figma-last-modified">${file.lastModified}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-8) var(--sp-16) 0;flex-shrink:0">
        <div class="avatar-stack">${collabs}</div>
        <span style="font-size:10px;color:var(--w32)">${file.frameCount} frames</span>
      </div>
      <button class="figma-open-btn">Open in Figma ↗</button>
    `;
  }

  // ── Panel metadata ────────────────────────────────────────
  const PANEL_META = {
    calendar: { name: 'Calendar',    icon: '📅', apiLabel: 'API_SLOT: Google Calendar' },
    triage:   { name: 'Cadence AI',  icon: '◆',  apiLabel: 'AI triage engine'          },
    tasks:    { name: 'Tasks',       icon: '✓',  apiLabel: 'API_SLOT: Linear / Jira'   },
    slack:    { name: 'Slack',       icon: '💬', apiLabel: 'API_SLOT: Slack Web API'    },
    notion:   { name: 'Notion',      icon: '📄', apiLabel: 'API_SLOT: Notion API'       },
    figma:    { name: 'Figma',       icon: '◻',  apiLabel: 'API_SLOT: Figma REST API'   },
  };

  function panelName(tool)     { return PANEL_META[tool]?.name     || tool; }
  function panelIcon(tool)     { return PANEL_META[tool]?.icon     || '○';  }
  function apiSlotLabel(tool)  { return PANEL_META[tool]?.apiLabel || '';   }

  // ── Panel positioning ─────────────────────────────────────
  function positionPanel(id) {
    const p = registry[id];
    if (!p) return;
    p.el.style.left = p.x + 'px';
    p.el.style.top  = p.y + 'px';
  }

  // ── Drag & resize ─────────────────────────────────────────
  let dragging  = null;  // { id, startX, startY, startPanX, startPanY }
  let resizing  = null;  // { id, startX, startY, startW, startH }

  function bindPanelEvents(el, id) {
    // Drag via handle
    const handle = el.querySelector('.panel-handle');
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.panel-actions')) return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(e, id);
    });

    // Resize via corner
    const resizeEl = el.querySelector('.resize-handle');
    resizeEl.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      startResize(e, id);
    });

    // Panel action buttons
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'pin')      togglePin(id);
      if (action === 'minimise') toggleMinimise(id);
    });

    // Calendar event expand
    el.addEventListener('click', e => {
      const ev = e.target.closest('.calendar-event');
      if (!ev) return;
      ev.classList.toggle('is-expanded');
    });

    // Triage card buttons
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-card][data-dir]');
      if (!btn) return;
      dismissTriageCard(btn.dataset.card, btn.dataset.dir);
    });

    // Triage swipe gesture
    bindTriageSwipe(el);

    // Task swipe gesture
    bindTaskSwipe(el);
  }

  function startDrag(e, id) {
    const p = registry[id];
    if (!p) return;
    dragging = {
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPanX: p.x,
      startPanY: p.y
    };
    p.el.classList.add('is-dragging');
    p.el.style.zIndex = 20;
  }

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const p = registry[dragging.id];
    const zoom = Canvas.getZoom();
    const dx = (e.clientX - dragging.startMouseX) / zoom;
    const dy = (e.clientY - dragging.startMouseY) / zoom;
    p.x = dragging.startPanX + dx;
    p.y = dragging.startPanY + dy;
    positionPanel(dragging.id);
    drawContextLines();
  });

  window.addEventListener('mouseup', e => {
    if (dragging) {
      registry[dragging.id].el.classList.remove('is-dragging');
      registry[dragging.id].el.style.zIndex = '';
      dragging = null;
      drawMinimapDots();
    }
    if (resizing) {
      resizing = null;
    }
  });

  function startResize(e, id) {
    const p = registry[id];
    if (!p) return;
    resizing = {
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: p.w,
      startH: p.h
    };
  }

  window.addEventListener('mousemove', e => {
    if (!resizing) return;
    const p = registry[resizing.id];
    const zoom = Canvas.getZoom();
    const dx = (e.clientX - resizing.startMouseX) / zoom;
    const dy = (e.clientY - resizing.startMouseY) / zoom;
    p.w = Math.max(260, resizing.startW + dx);
    p.h = Math.max(180, resizing.startH + dy);
    p.el.style.width  = p.w + 'px';
    p.el.style.height = p.h + 'px';
    drawContextLines();
  });

  // ── Pin / Minimise ────────────────────────────────────────
  function togglePin(id) {
    const p = registry[id];
    if (!p) return;
    const isPinned = p.el.classList.toggle('is-pinned');
    p.el.querySelector('[data-action="pin"]').style.color = isPinned ? 'var(--c3)' : '';
  }

  function toggleMinimise(id) {
    const p = registry[id];
    if (!p) return;
    const body = p.el.querySelector('.panel-body');
    const foot = p.el.querySelector('.panel-footer');
    const isMin = body.style.display === 'none';
    body.style.display = isMin ? '' : 'none';
    foot.style.display = isMin ? '' : 'none';
    p.el.querySelector('[data-action="minimise"]').textContent = isMin ? '−' : '+';
    drawContextLines();
  }

  // ── Triage card swipe ─────────────────────────────────────
  function bindTriageSwipe(panelEl) {
    panelEl.addEventListener('mousedown', e => {
      const card = e.target.closest('.triage-card');
      if (!card || e.target.closest('button')) return;

      const startX = e.clientX;
      const cardId = card.dataset.card;
      let delta = 0;

      const onMove = ev => {
        delta = ev.clientX - startX;
        card.style.transform = `translateX(${delta * 0.4}px)`;
        card.classList.toggle('is-approved', delta > 30);
        card.classList.toggle('is-declined', delta < -30);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        card.style.transform = '';
        card.classList.remove('is-approved', 'is-declined');
        if (Math.abs(delta) > 60) {
          dismissTriageCard(cardId, delta > 0 ? 'right' : 'left');
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function dismissTriageCard(cardId, dir) {
    const card = document.querySelector(`.triage-card[data-card="${cardId}"]`);
    if (!card) return;
    card.classList.add('dismissing', dir === 'right' ? 'dismiss-right' : 'dismiss-left');

    // Log to activity
    const action = dir === 'right' ? 'approved' : 'deferred';
    Presence.showActivity(MOCK.user, `${action} a triage card`);

    setTimeout(() => {
      card.remove();
      checkTriageEmpty();
    }, 450);
  }

  function checkTriageEmpty() {
    const list = document.querySelector('.triage-list');
    if (!list) return;
    if (!list.querySelector('.triage-card')) {
      list.innerHTML = `
        <div class="triage-empty">
          <div class="triage-empty-icon">✓</div>
          <p class="triage-empty-text">All clear — nothing needs your attention right now.</p>
        </div>
      `;
    }
  }

  // ── Task swipe ────────────────────────────────────────────
  function bindTaskSwipe(panelEl) {
    panelEl.addEventListener('mousedown', e => {
      const item = e.target.closest('.task-item');
      if (!item) return;

      const startX = e.clientX;
      let delta = 0;

      const onMove = ev => {
        delta = ev.clientX - startX;
        if (Math.abs(delta) > 10) {
          item.style.transform = `translateX(${Math.min(60, Math.max(-60, delta * 0.5))}px)`;
          item.classList.toggle('is-swiping-right', delta > 20);
          item.classList.toggle('is-swiping-left',  delta < -20);
        }
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        item.style.transform = '';
        item.classList.remove('is-swiping-right', 'is-swiping-left');
        if (delta > 60) markTaskDone(item);
        if (delta < -60) deferTask(item);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function markTaskDone(item) {
    const check = item.querySelector('.task-check');
    check.style.background = 'var(--color-done)';
    check.style.borderColor = 'var(--color-done)';
    check.innerHTML = '<span style="color:#fff;font-size:9px">✓</span>';
    item.style.opacity = '0.4';
    const statusEl = item.querySelector('.task-status');
    if (statusEl) {
      statusEl.className = 'task-status status-done';
      statusEl.textContent = 'Done';
    }
  }

  function deferTask(item) {
    const dueEl = item.querySelector('.task-due');
    if (dueEl) dueEl.textContent = 'Deferred';
    item.style.opacity = '0.5';
  }

  // ── Context lines ─────────────────────────────────────────
  function drawContextLines() {
    if (!svgEl) return;
    svgEl.innerHTML = '';

    CONNECTIONS.forEach(({ from, to }) => {
      const pFrom = registry[from];
      const pTo   = registry[to];
      if (!pFrom || !pTo) return;

      const fx = pFrom.x + pFrom.w / 2;
      const fy = pFrom.y + pFrom.h / 2;
      const tx = pTo.x   + pTo.w   / 2;
      const ty = pTo.y   + pTo.h   / 2;

      // Bezier control points
      const cx1 = fx + (tx - fx) * 0.4;
      const cy1 = fy;
      const cx2 = tx - (tx - fx) * 0.4;
      const cy2 = ty;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${fx} ${fy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`);
      path.classList.add('context-line');
      svgEl.appendChild(path);
    });
  }

  // ── Minimap dots ──────────────────────────────────────────
  function drawMinimapDots() {
    const mm = document.getElementById('minimap');
    if (!mm) return;

    mm.querySelectorAll('.minimap-panel-dot').forEach(d => d.remove());

    const WORLD_W = 6000, WORLD_H = 5000;
    const mmW = mm.clientWidth;
    const mmH = mm.clientHeight;

    Object.values(registry).forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'minimap-panel-dot';
      dot.style.left   = (p.x / WORLD_W * mmW) + 'px';
      dot.style.top    = (p.y / WORLD_H * mmH) + 'px';
      dot.style.width  = Math.max(4, p.w / WORLD_W * mmW) + 'px';
      dot.style.height = Math.max(3, p.h / WORLD_H * mmH) + 'px';
      mm.appendChild(dot);
    });
  }

  // ── Click minimap to navigate ─────────────────────────────
  function initMinimapClick() {
    const mm = document.getElementById('minimap');
    if (!mm) return;
    mm.addEventListener('click', e => {
      const rect = mm.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top)  / rect.height;
      const WORLD_W = 6000, WORLD_H = 5000;
      const wx = fx * WORLD_W;
      const wy = fy * WORLD_H;
      const vw = document.getElementById('canvas-viewport').clientWidth;
      const vh = document.getElementById('canvas-viewport').clientHeight;
      const z  = Canvas.getZoom();
      // We can't set target directly — use Canvas.panTo if exposed
      // Simplified: just update via transform
      const world = document.getElementById('canvas-world');
      world._targetPanX = vw/2 - wx * z;
      world._targetPanY = vh/2 - wy * z;
    });
  }

  return { init, drawContextLines, drawMinimapDots };

})();
