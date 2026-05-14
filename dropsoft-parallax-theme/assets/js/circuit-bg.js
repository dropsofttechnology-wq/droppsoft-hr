/**
 * Dropsoft — circuit-board background: procedural traces + cursor parallax.
 * Image layer is CSS; this canvas adds animated lines that follow the pointer (smoothed).
 */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var root = document.querySelector('.ds-circuit-bg');
  var canvas = root && root.querySelector('.ds-circuit-bg__canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0;
  var h = 0;

  /** Smoothed cursor in CSS pixels */
  var cx = 0;
  var cy = 0;
  var tx = 0;
  var ty = 0;

  /** Parallax offset applied to drawing (CSS px) */
  var px = 0;
  var py = 0;
  var pxt = 0;
  var pyt = 0;

  /** Generated geometry (CSS pixel space) */
  var segments = [];
  var glowNodes = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function buildGeometry() {
    segments = [];
    glowNodes = [];
    var i;
    var x;
    var y;
    var x2;
    var y2;
    var steps;

    /* Bias activity to the left third (matches reference art) */
    for (i = 0; i < 55; i++) {
      x = rand(0, w * 0.52);
      y = rand(0, h);
      steps = Math.floor(rand(2, 6));
      while (steps--) {
        if (Math.random() < 0.55) {
          x2 = x + rand(w * 0.04, w * 0.18);
          y2 = y;
        } else if (Math.random() < 0.5) {
          x2 = x;
          y2 = y + rand(-h * 0.12, h * 0.12);
        } else {
          var len = rand(40, 140);
          x2 = x + len * (Math.random() < 0.5 ? 1 : -1);
          y2 = y + len * (Math.random() < 0.5 ? 1 : -1);
        }
        if (x2 < 0) x2 = 0;
        if (x2 > w) x2 = w;
        if (y2 < 0) y2 = 0;
        if (y2 > h) y2 = h;
        segments.push({ x1: x, y1: y, x2: x2, y2: y2, w: rand(0.6, 1.4) });
        if (Math.random() < 0.35) {
          glowNodes.push({ x: x2, y: y2, r: rand(1.5, 3.5), ph: rand(0, Math.PI * 2) });
        }
        x = x2;
        y = y2;
      }
    }

    /* Sparse long runners toward open right side */
    for (i = 0; i < 18; i++) {
      x = rand(w * 0.15, w * 0.65);
      y = rand(0, h);
      x2 = rand(w * 0.75, w);
      y2 = y + rand(-40, 40);
      segments.push({ x1: x, y1: y, x2: x2, y2: y2, w: rand(0.4, 0.9) });
    }
  }

  function resize() {
    var rect = root.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
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
  }

  function onMove(e) {
    var rect = root.getBoundingClientRect();
    tx = e.clientX - rect.left;
    ty = e.clientY - rect.top;
  }

  function onTouch(e) {
    if (!e.touches || !e.touches[0]) return;
    onMove(e.touches[0]);
  }

  function onLeave() {
    tx = w * 0.5;
    ty = h * 0.5;
  }

  var t0 = performance.now();

  function frame(now) {
    var t = (now - t0) * 0.001;
    var pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.7));

    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;

    /* Pull traces toward cursor (screen-space feel) */
    var targetPx = ((cx / w) - 0.5) * 56;
    var targetPy = ((cy / h) - 0.5) * 42;
    pxt += (targetPx - pxt) * 0.06;
    pyt += (targetPy - pyt) * 0.06;
    px += (pxt - px) * 0.14;
    py += (pyt - py) * 0.14;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(px, py);

    var i;
    var s;
    var alpha;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (i = 0; i < segments.length; i++) {
      s = segments[i];
      alpha = (0.12 + 0.2 * s.w) * pulse;
      if (s.x1 < w * 0.45) alpha *= 1.15;

      ctx.strokeStyle = 'rgba(0, 220, 255, ' + alpha.toFixed(3) + ')';
      ctx.shadowColor = 'rgba(0, 200, 255, 0.45)';
      ctx.shadowBlur = 8 * s.w;
      ctx.lineWidth = 1.1 * s.w;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    for (i = 0; i < glowNodes.length; i++) {
      var n = glowNodes[i];
      var a = 0.35 + 0.35 * Math.sin(t * 1.3 + n.ph);
      ctx.fillStyle = 'rgba(0, 242, 255, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', function () {
    resize();
  });
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  root.addEventListener('mouseleave', onLeave);

  requestAnimationFrame(frame);
})();
