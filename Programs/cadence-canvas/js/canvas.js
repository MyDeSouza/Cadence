// cadence-canvas / js / canvas.js
// Spatial engine — pan, zoom, coordinate transforms

const Canvas = (() => {

  // ── State ──────────────────────────────────────────────────
  const state = {
    panX: 0,
    panY: 0,
    zoom: 1,
    minZoom: 0.25,
    maxZoom: 2.5,
    isPanning: false,
    panMode: false,       // activated by Space hold
    lastPointer: { x: 0, y: 0 },
    raf: null,
  };

  // Target state for smooth animation
  const target = { panX: 0, panY: 0, zoom: 1 };

  let viewport, world, zoomLevelEl;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    viewport = document.getElementById('canvas-viewport');
    world    = document.getElementById('canvas-world');
    zoomLevelEl = document.querySelector('.zoom-level');

    bindEvents();
    centerOnPanels();
    renderLoop();
  }

  // ── Center view on panel cluster ──────────────────────────
  function centerOnPanels() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    // Panel cluster center (approximate, matches initial layout in panels.js)
    const clusterCX = 760;
    const clusterCY = 560;

    target.panX = vw / 2 - clusterCX * target.zoom;
    target.panY = vh / 2 - clusterCY * target.zoom;
    state.panX  = target.panX;
    state.panY  = target.panY;

    applyTransform();
  }

  // ── Event binding ─────────────────────────────────────────
  function bindEvents() {
    // Wheel = zoom
    viewport.addEventListener('wheel', onWheel, { passive: false });

    // Mouse pan (middle button or space+left)
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Space = pan mode
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Touch — pinch and pan
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);

    // Zoom buttons
    document.getElementById('zoom-in') ?.addEventListener('click', () => zoomBy(1.2));
    document.getElementById('zoom-out')?.addEventListener('click', () => zoomBy(0.8));
    document.getElementById('zoom-reset')?.addEventListener('click', resetZoom);
  }

  // ── Wheel handler (zoom toward cursor) ────────────────────
  function onWheel(e) {
    e.preventDefault();

    // Trackpad two-finger pan (ctrlKey = pinch on Mac)
    if (!e.ctrlKey && Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) < 30) {
      // Horizontal scroll = pan
      target.panX -= e.deltaX * 1.2;
      target.panY -= e.deltaY * 1.2;
      return;
    }

    const zoomFactor = e.ctrlKey
      ? (e.deltaY < 0 ? 1.08 : 0.93)   // pinch
      : (e.deltaY < 0 ? 1.12 : 0.89);  // scroll wheel

    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    applyZoomToward(zoomFactor, mx, my);
  }

  // ── Mouse handlers ────────────────────────────────────────
  function onMouseDown(e) {
    // Middle button OR space+left
    if (e.button === 1 || (e.button === 0 && state.panMode)) {
      e.preventDefault();
      state.isPanning = true;
      state.lastPointer = { x: e.clientX, y: e.clientY };
      viewport.classList.add('is-panning');
    }
  }

  function onMouseMove(e) {
    if (!state.isPanning) return;
    const dx = e.clientX - state.lastPointer.x;
    const dy = e.clientY - state.lastPointer.y;
    state.lastPointer = { x: e.clientX, y: e.clientY };

    target.panX += dx;
    target.panY += dy;
  }

  function onMouseUp(e) {
    if (state.isPanning) {
      state.isPanning = false;
      viewport.classList.remove('is-panning');
    }
  }

  // ── Keyboard ──────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      if (!state.panMode) {
        state.panMode = true;
        viewport.classList.add('pan-mode');
      }
    }
    if ((e.key === '+' || e.key === '=') && !e.ctrlKey) zoomBy(1.15);
    if (e.key === '-' && !e.ctrlKey) zoomBy(0.87);
    if (e.key === '0' && !e.ctrlKey) resetZoom();
    if (e.key === 'f') fitAll();
  }

  function onKeyUp(e) {
    if (e.code === 'Space') {
      state.panMode = false;
      viewport.classList.remove('pan-mode');
    }
  }

  // ── Touch ─────────────────────────────────────────────────
  let lastTouches = null;

  function onTouchStart(e) {
    lastTouches = e.touches;
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!lastTouches) return;

    if (e.touches.length === 2 && lastTouches.length === 2) {
      const prev = getTouchMidpoint(lastTouches);
      const curr = getTouchMidpoint(e.touches);
      const prevDist = getTouchDistance(lastTouches);
      const currDist = getTouchDistance(e.touches);

      // Pan
      const rect = viewport.getBoundingClientRect();
      target.panX += (curr.x - prev.x);
      target.panY += (curr.y - prev.y);

      // Pinch zoom
      if (prevDist > 0) {
        const factor = currDist / prevDist;
        const mx = curr.x - rect.left;
        const my = curr.y - rect.top;
        applyZoomToward(factor, mx, my);
      }
    } else if (e.touches.length === 1 && lastTouches.length === 1) {
      const dx = e.touches[0].clientX - lastTouches[0].clientX;
      const dy = e.touches[0].clientY - lastTouches[0].clientY;
      target.panX += dx;
      target.panY += dy;
    }

    lastTouches = e.touches;
  }

  function onTouchEnd(e) {
    lastTouches = e.touches.length ? e.touches : null;
  }

  function getTouchMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Zoom helpers ──────────────────────────────────────────
  function applyZoomToward(factor, mx, my) {
    const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, target.zoom * factor));
    const realFactor = newZoom / target.zoom;

    // Keep the point under pointer fixed
    target.panX = mx - (mx - target.panX) * realFactor;
    target.panY = my - (my - target.panY) * realFactor;
    target.zoom = newZoom;
  }

  function zoomBy(factor) {
    const vw = viewport.clientWidth / 2;
    const vh = viewport.clientHeight / 2;
    applyZoomToward(factor, vw, vh);
  }

  function resetZoom() {
    centerOnPanels();
    target.zoom = 1;
  }

  function fitAll() {
    // Fit all panels into view
    const panels = document.querySelectorAll('.panel');
    if (!panels.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    panels.forEach(p => {
      const x = parseFloat(p.style.left) || 0;
      const y = parseFloat(p.style.top)  || 0;
      const w = p.offsetWidth  || 320;
      const h = p.offsetHeight || 400;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const padding = 80;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    const newZoom = Math.min(vw / contentW, vh / contentH, 1.2);

    target.zoom = Math.max(state.minZoom, Math.min(state.maxZoom, newZoom));
    target.panX = (vw - (maxX + minX) * target.zoom) / 2;
    target.panY = (vh - (maxY + minY) * target.zoom) / 2;
  }

  // ── Render loop (lerp for smooth movement) ────────────────
  function renderLoop() {
    const lerp = (a, b, t) => a + (b - a) * t;
    const SMOOTH = 0.18;

    function tick() {
      let dirty = false;

      const nx = lerp(state.panX, target.panX, SMOOTH);
      const ny = lerp(state.panY, target.panY, SMOOTH);
      const nz = lerp(state.zoom, target.zoom, SMOOTH);

      if (Math.abs(nx - state.panX) > 0.05 || Math.abs(ny - state.panY) > 0.05 || Math.abs(nz - state.zoom) > 0.0005) {
        state.panX = nx;
        state.panY = ny;
        state.zoom = nz;
        dirty = true;
      } else {
        state.panX = target.panX;
        state.panY = target.panY;
        state.zoom = target.zoom;
      }

      if (dirty) applyTransform();

      state.raf = requestAnimationFrame(tick);
    }

    state.raf = requestAnimationFrame(tick);
  }

  // ── Apply CSS transform ───────────────────────────────────
  function applyTransform() {
    world.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;

    if (zoomLevelEl) {
      zoomLevelEl.textContent = Math.round(state.zoom * 100) + '%';
    }

    updateMinimap();
  }

  // ── Minimap ───────────────────────────────────────────────
  let minimapEl, minimapViewport;

  function updateMinimap() {
    if (!minimapEl) {
      minimapEl = document.getElementById('minimap');
      minimapViewport = minimapEl?.querySelector('.minimap-viewport');
    }
    if (!minimapEl || !minimapViewport) return;

    const WORLD_W = 6000, WORLD_H = 5000;
    const mm = minimapEl;
    const mmW = mm.clientWidth;
    const mmH = mm.clientHeight;
    const scaleX = mmW / WORLD_W;
    const scaleY = mmH / WORLD_H;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    // Viewport rect in world space
    const vpLeft   = -state.panX / state.zoom;
    const vpTop    = -state.panY / state.zoom;
    const vpRight  = vpLeft + vw / state.zoom;
    const vpBottom = vpTop  + vh / state.zoom;

    const mmLeft   = Math.max(0, vpLeft   * scaleX);
    const mmTop    = Math.max(0, vpTop    * scaleY);
    const mmRight  = Math.min(mmW, vpRight  * scaleX);
    const mmBottom = Math.min(mmH, vpBottom * scaleY);

    minimapViewport.style.left   = mmLeft  + 'px';
    minimapViewport.style.top    = mmTop   + 'px';
    minimapViewport.style.width  = Math.max(4, mmRight  - mmLeft) + 'px';
    minimapViewport.style.height = Math.max(4, mmBottom - mmTop)  + 'px';
  }

  // ── Public helpers ────────────────────────────────────────
  // Convert screen coordinates to canvas-world coordinates
  function screenToWorld(sx, sy) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (sx - rect.left - state.panX) / state.zoom,
      y: (sy - rect.top  - state.panY) / state.zoom
    };
  }

  // Convert canvas-world coordinates to screen coordinates
  function worldToScreen(wx, wy) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: wx * state.zoom + state.panX + rect.left,
      y: wy * state.zoom + state.panY + rect.top
    };
  }

  function getZoom()  { return state.zoom; }
  function getPan()   { return { x: state.panX, y: state.panY }; }

  return { init, screenToWorld, worldToScreen, getZoom, getPan, fitAll };

})();
