/**
 * Dropsoft — circuit-board background (desktop only in WP; lightweight canvas).
 * Skips entirely if no canvas. Pauses when tab hidden. No shadowBlur (GPU-heavy).
 */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  /* Extra guard: coarse pointer / small viewport = do not run (e.g. tablet desktop UA). */
  if (window.matchMedia) {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches) return;
  }

  var root = document.querySelector('.ds-circuit-bg');
  var canvas = root && root.querySelector('.ds-circuit-bg__canvas');
  if (!canvas) return;

  var ctx;
  try {
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  } catch (e) {
    ctx = null;
  }
  if (!ctx) {
    ctx = canvas.getContext('2d');
  }
  if (!ctx) return;

  var dpr = 1;
  var w = 0;
  var h = 0;
  var rafId = 0;
  var running = false;

  var cx = 0;
  var cy = 0;
  var tx = 0;
  var ty = 0;
  var px = 0;
  var py = 0;
  var pxt = 0;
  var pyt = 0;

  var segments = [];
  var glowNodes = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function buildGeometry() {
    segments = [];
    glowNodes = [];
    var area = w * h;
    /* Fewer segments on smaller windows */
    var count = area > 900000 ? 28 : area > 500000 ? 20 : 14;
    var longRunners = area > 900000 ? 10 : 6;
    var i;
    var x;
    var y;
    var x2;
    var y2;
    var steps;

    for (i = 0; i < count; i++) {
      x = rand(0, w * 0.52);
      y = rand(0, h);
      steps = Math.floor(rand(2, 5));
      while (steps--) {
        if (Math.random() < 0.55) {
          x2 = x + rand(w * 0.04, w * 0.16);
          y2 = y;
        } else if (Math.random() < 0.5) {
          x2 = x;
          y2 = y + rand(-h * 0.1, h * 0.1);
        } else {
          var len = rand(36, 100);
          x2 = x + len * (Math.random() < 0.5 ? 1 : -1);
          y2 = y + len * (Math.random() < 0.5 ? 1 : -1);
        }
        if (x2 < 0) x2 = 0;
        if (x2 > w) x2 = w;
        if (y2 < 0) y2 = 0;
        if (y2 > h) y2 = h;
        segments.push({ x1: x, y1: y, x2: x2, y2: y2, w: rand(0.6, 1.3) });
        if (Math.random() < 0.28) {
          glowNodes.push({ x: x2, y: y2, r: rand(1.2, 2.8), ph: rand(0, Math.PI * 2) });
        }
        x = x2;
        y = y2;
      }
    }

    for (i = 0; i < longRunners; i++) {
      x = rand(w * 0.15, w * 0.65);
      y = rand(0, h);
      x2 = rand(w * 0.75, w);
      y2 = y + rand(-32, 32);
      segments.push({ x1: x, y1: y, x2: x2, y2: y2, w: rand(0.4, 0.85) });
    }
  }

  function resize() {
    var rect = root.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    if (w < 880 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches)) {
      stop();
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = 'block';

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w * 0.5;
    cy = h * 0.5;
    tx = cx;
    ty = cy;
    buildGeometry();
    if (!document.hidden) {
      start();
    }
  }

  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) window.cancelAnimationFrame(resizeTimer);
    resizeTimer = window.requestAnimationFrame(function () {
      resizeTimer = null;
      resize();
    });
  }

  var moveRaf = 0;
  var lastMoveEvent = null;

  function onMove(e) {
    lastMoveEvent = e;
    if (moveRaf) return;
    moveRaf = window.requestAnimationFrame(function () {
      moveRaf = 0;
      var ev = lastMoveEvent;
      if (!ev) return;
      var rect = root.getBoundingClientRect();
      tx = ev.clientX - rect.left;
      ty = ev.clientY - rect.top;
    });
  }

  function onLeave() {
    tx = w * 0.5;
    ty = h * 0.5;
  }

  var t0 = performance.now();

  function frame(now) {
    if (!running) return;
    if (w < 2 || h < 2) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    if (!segments.length) {
      stop();
      return;
    }

    var t = (now - t0) * 0.001;
    var pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.65));

    cx += (tx - cx) * 0.1;
    cy += (ty - cy) * 0.1;

    var targetPx = ((cx / w) - 0.5) * 40;
    var targetPy = ((cy / h) - 0.5) * 30;
    pxt += (targetPx - pxt) * 0.055;
    pyt += (targetPy - pyt) * 0.055;
    px += (pxt - px) * 0.12;
    py += (pyt - py) * 0.12;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(px, py);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var i;
    var s;
    var alpha;
    /* Cheap glow: wide faint stroke, then thin bright line (no shadowBlur). */
    for (i = 0; i < segments.length; i++) {
      s = segments[i];
      alpha = (0.08 + 0.14 * s.w) * pulse;
      if (s.x1 < w * 0.45) alpha *= 1.12;

      ctx.strokeStyle = 'rgba(0, 180, 220, ' + (alpha * 0.45).toFixed(3) + ')';
      ctx.lineWidth = 3.2 * s.w;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 230, 255, ' + (alpha * 1.35).toFixed(3) + ')';
      ctx.lineWidth = 1 * s.w;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    for (i = 0; i < glowNodes.length; i++) {
      var n = glowNodes[i];
      var a = 0.28 + 0.32 * Math.sin(t * 1.15 + n.ph);
      ctx.fillStyle = 'rgba(0, 242, 255, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    t0 = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function onVisibility() {
    if (document.hidden) {
      stop();
    } else {
      resize();
    }
  }

  resize();
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('mousemove', onMove, { passive: true });
  root.addEventListener('mouseleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
})();
