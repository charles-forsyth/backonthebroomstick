/* Back on the Broomstick: the Sky page's 3D drawings on <canvas>. Ports of the Hedge Almanac app's Orrery.kt (the sky
   from Earth) and ChartWheel.kt (natal wheel that tilts into a real perspective plate). No libraries. */
(function (root) {
  'use strict';
  const E = root.BotbAstro;
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const C = {
    gold: '#d9a74a', amethyst: '#a67fd8', ember: '#c4584a', text: '#eee4d3', muted: '#b0a3bf', line: '#3a2a55', bg: '#120d1a',
    body: { sun: '#ffd27a', moon: '#e9e4da', mercury: '#b8afa6', venus: '#f2d7a6', mars: '#d9694a', jupiter: '#d8b48a', saturn: '#e3cc92', uranus: '#9fd6db', neptune: '#6e8fe0', pluto: '#b59a8a', node: '#d9a74a' },
    element: { Fire: '#e08a4f', Earth: '#9db07a', Air: '#b9c6e8', Water: '#7fa6d8' },
    aspect: { conjunction: '#d9a74a', trine: '#a67fd8', sextile: '#a67fd8', square: '#c4584a', opposition: '#c4584a' }
  };
  const GLYPH_FONT = "'Astro Glyphs', 'Noto Sans Symbols', 'Segoe UI Symbol', serif";
  const vs = (s) => s + '\uFE0E';
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const mix = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t)); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- camera (same maths as Camera3D.kt) ---------- */
  function Camera() { this.yaw = -0.6; this.pitch = 0.9; this.distance = 15; this.fov = 58; }
  Camera.prototype.update = function (w, h, cy) {
    this.w = w; this.h = h; this.cx = w / 2; this.cy = cy == null ? h / 2 : cy;
    this.sy = Math.sin(this.yaw); this.cyw = Math.cos(this.yaw); this.sp = Math.sin(this.pitch); this.cp = Math.cos(this.pitch);
    this.f = h / 2 / Math.tan((this.fov / 2) * D2R);
  };
  Camera.prototype.project = function (x, y, z, out) {
    const x1 = x * this.cyw + y * this.sy, y1 = -x * this.sy + y * this.cyw;
    const y2 = y1 * this.cp + z * this.sp, z2 = -y1 * this.sp + z * this.cp;
    const depth = this.distance - z2, s = this.f / Math.max(0.1, depth);
    out[0] = this.cx + x1 * s; out[1] = this.cy - y2 * s; out[2] = s;
    return depth;
  };

  function setup(canvas) {
    const dpr = Math.min(2, root.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
    const w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }
  function glyphAt(g, text, x, y, size, color) { g.font = `${size}px ${GLYPH_FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(vs(text), x, y); }
  function label(g, text, x, y, size, color) { g.font = `${size}px 'JetBrains Mono', monospace`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y); }
  function sphere(g, x, y, r, base, lx, ly, alpha) {
    if (r <= 0) return;
    const hx = x + lx * r * 0.45, hy = y + ly * r * 0.45, grd = g.createRadialGradient(hx, hy, 0, hx, hy, r * 1.6);
    grd.addColorStop(0, mix(base, '#ffffff', 0.35)); grd.addColorStop(0.55, base); grd.addColorStop(1, mix(base, '#000000', 0.82));
    g.globalAlpha = alpha; g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 0.7; g.stroke(); g.globalAlpha = 1;
  }

  /* ---------- the orrery ---------- */
  const RING = { moon: 1.6, mercury: 2.4, venus: 3.1, sun: 3.9, mars: 4.7, jupiter: 5.6, saturn: 6.4, uranus: 7.1, neptune: 7.7, pluto: 8.3, node: 9.2 };
  const SIZE = { sun: 0.42, moon: 0.22, jupiter: 0.34, saturn: 0.3, mercury: 0.13, venus: 0.18, mars: 0.16, uranus: 0.21, neptune: 0.2, pluto: 0.11, node: 0 };

  function starDome(n, seed) {
    let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, t = rnd() * TAU, q = Math.sqrt(1 - u * u); out.set([40 * q * Math.cos(t), 40 * q * Math.sin(t), 40 * u, 0.25 + rnd() * 0.75], i * 4); }
    return out;
  }

  /**
   * Orrery(canvas, opts): opts.onTap(key|null), opts.backdrop. Call .set(bodies) with [{key, lon, lat, retro, trail}]
   * and .select(key). Drag to turn, wheel/pinch to zoom.
   */
  function Orrery(canvas, opts = {}) {
    const cam = new Camera(), stars = starDome(260, 11), tmp = [0, 0, 0];
    let bodies = [], selected = null, zoomK = 1, lastInteract = 0, raf = 0, screen = {}, visible = true;
    const self = { set(b) { bodies = b; }, select(k) { selected = k; }, stop() { cancelAnimationFrame(raf); } };

    function ring(g, r, color, w) {
      g.beginPath();
      for (let k = 0; k <= 96; k++) { const a = (k / 96) * TAU; cam.project(r * Math.cos(a), r * Math.sin(a), 0, tmp); k ? g.lineTo(tmp[0], tmp[1]) : g.moveTo(tmp[0], tmp[1]); }
      g.strokeStyle = color; g.lineWidth = w || 0.8; g.stroke();
    }
    function draw() {
      const { g, w, h } = setup(canvas);
      g.clearRect(0, 0, w, h);
      const f0 = h / 2 / Math.tan((cam.fov / 2) * D2R);
      // distance so the band (radius 11) fits the width, and its tilted depth fits the height, with a margin
      const fitW = (11 * f0) / (0.46 * w), fitH = (11 * Math.cos(cam.pitch) * f0) / (0.40 * h);
      const fit = Math.max(fitW, fitH) + 11 * Math.sin(cam.pitch) * 0.55;
      cam.distance = fit * zoomK * 1.08; cam.update(w, h, h * (opts.backdrop ? 0.5 : 0.43));
      // stars
      for (let i = 0; i < 260; i++) {
        const d = cam.project(stars[i * 4], stars[i * 4 + 1], stars[i * 4 + 2], tmp); if (d <= 0.5) continue;
        const b = stars[i * 4 + 3]; g.fillStyle = rgba('#eee4d3', 0.18 + 0.55 * b); g.beginPath(); g.arc(tmp[0], tmp[1], (0.6 + b) * 0.8, 0, TAU); g.fill();
      }
      // zodiac band
      const r1 = 9.8, r2 = 11;
      ring(g, r1, rgba(C.gold, 0.55)); ring(g, r2, rgba(C.gold, 0.55));
      for (let s = 0; s < 12; s++) {
        const a = s * 30 * D2R; cam.project(r1 * Math.cos(a), r1 * Math.sin(a), 0, tmp); const x1 = tmp[0], y1 = tmp[1];
        cam.project(r2 * Math.cos(a), r2 * Math.sin(a), 0, tmp);
        g.strokeStyle = rgba(C.gold, 0.45); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x1, y1); g.lineTo(tmp[0], tmp[1]); g.stroke();
        if (!opts.backdrop) {
          const am = (s * 30 + 15) * D2R, rm = (r1 + r2) / 2, depth = cam.project(rm * Math.cos(am), rm * Math.sin(am), 0, tmp);
          const sc = Math.max(0.5, Math.min(1.6, cam.distance / Math.max(1, depth)));
          glyphAt(g, E.SIGNS[s].glyph, tmp[0], tmp[1], 15 * sc, rgba(C.gold, Math.min(1, 0.55 + 0.45 * sc)));
        }
      }
      for (let d = 0; d < 360; d += 5) {
        if (d % 30 === 0) continue;
        const a = d * D2R; cam.project(r1 * Math.cos(a), r1 * Math.sin(a), 0, tmp); const x1 = tmp[0], y1 = tmp[1];
        cam.project((r1 + 0.2) * Math.cos(a), (r1 + 0.2) * Math.sin(a), 0, tmp);
        g.strokeStyle = rgba(C.gold, 0.3); g.lineWidth = 0.6; g.beginPath(); g.moveTo(x1, y1); g.lineTo(tmp[0], tmp[1]); g.stroke();
      }
      for (const b of bodies) if (b.key !== 'node') ring(g, RING[b.key], b.key === selected ? rgba(C.gold, 0.55) : rgba(C.line, 0.85));
      // retrograde trails
      if (!opts.backdrop) for (const b of bodies) if (b.trail && b.trail.length > 1) {
        g.setLineDash([3, 4]); g.strokeStyle = rgba(C.ember, 0.55); g.lineWidth = 1.1; g.beginPath();
        b.trail.forEach((lon, k) => { const a = lon * D2R, lift = 0.25 * Math.sin((k / (b.trail.length - 1)) * Math.PI), r = RING[b.key] + lift; cam.project(r * Math.cos(a), r * Math.sin(a), 0, tmp); k ? g.lineTo(tmp[0], tmp[1]) : g.moveTo(tmp[0], tmp[1]); });
        g.stroke(); g.setLineDash([]);
      }
      // Earth
      cam.project(0, 0, 0, tmp); sphere(g, tmp[0], tmp[1], 0.26 * tmp[2], '#5b8fd6', 0, 0, 1);
      // bodies, far to near
      const sun = bodies.find((b) => b.key === 'sun'), sunLon = sun ? sun.lon : 0;
      const list = bodies.filter((b) => b.key !== 'node').map((b) => {
        const r = RING[b.key], a = b.lon * D2R, z = r * Math.sin((b.lat || 0) * D2R) * 2.2;
        const depth = cam.project(r * Math.cos(a), r * Math.sin(a), z, tmp);
        return { b, depth, x: tmp[0], y: tmp[1], s: tmp[2] };
      }).sort((p, q) => q.depth - p.depth);
      const placed = []; screen = {};
      for (const p of list) {
        const { b, x, y } = p, pr = Math.max(3, SIZE[b.key] * p.s);
        screen[b.key] = [x, y];
        let lx = 0, ly = 0;
        if (b.key !== 'sun') { const la = sunLon * D2R, r = RING.sun; cam.project(r * Math.cos(la), r * Math.sin(la), 0, tmp); const dx = tmp[0] - x, dy = tmp[1] - y, len = Math.max(1, Math.hypot(dx, dy)); lx = dx / len; ly = dy / len; }
        if (b.key === 'sun') {
          let grd = g.createRadialGradient(x, y, 0, x, y, pr * 4.5); grd.addColorStop(0, 'rgba(255,210,122,0.6)'); grd.addColorStop(1, 'rgba(255,210,122,0)');
          g.fillStyle = grd; g.beginPath(); g.arc(x, y, pr * 4.5, 0, TAU); g.fill();
          grd = g.createRadialGradient(x, y, 0, x, y, pr); grd.addColorStop(0, '#fff4d6'); grd.addColorStop(0.6, '#ffd27a'); grd.addColorStop(1, '#e0962e');
          g.fillStyle = grd; g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill();
        } else if (b.key === 'moon') {
          drawMoonPhase(g, x, y, pr, sunLon, b.lon, Math.atan2(ly, lx));
        } else {
          const fog = 1 - Math.max(0, Math.min(0.45, (p.depth * 1.3 - 8) / 24));
          sphere(g, x, y, pr, C.body[b.key], lx, ly, fog);
          if (b.key === 'saturn') { g.strokeStyle = 'rgba(227,204,146,0.67)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, y, pr * 2.3, pr * 0.6, 0, 0, TAU); g.stroke(); }
        }
        if (b.key === selected) { g.strokeStyle = C.gold; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, pr + 6, 0, TAU); g.stroke(); }
        if (opts.backdrop) continue;
        let yy = y - pr - 11, tries = 0;
        while (tries < 6 && placed.some((q) => Math.abs(q[0] - x) < 26 && Math.abs(q[1] - yy) < 16)) { yy -= 15; tries++; }
        placed.push([x, yy]);
        g.strokeStyle = 'rgba(238,228,211,0.18)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y - pr); g.lineTo(x, yy + 7); g.stroke();
        glyphAt(g, E.B[b.key].glyph + (b.retro ? '\u211E' : ''), x, yy, 13, b.retro ? '#ee9a88' : 'rgba(238,228,211,0.9)');
      }
    }
    function drawMoonPhase(g, x, y, r, sunLon, moonLon, ang) {
      g.fillStyle = '#2a2433'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      const elong = (((moonLon - sunLon) % 360) + 360) % 360, k = (1 - Math.cos(elong * D2R)) / 2, e = r * (1 - 2 * k);
      g.save(); g.translate(x, y); g.rotate(ang); g.beginPath();
      for (let i = 0; i <= 48; i++) { const t = -Math.PI / 2 + (Math.PI * i) / 48; const px = r * Math.cos(t), py = r * Math.sin(t); i ? g.lineTo(px, py) : g.moveTo(px, py); }
      for (let i = 48; i >= 0; i--) { const t = -Math.PI / 2 + (Math.PI * i) / 48; g.lineTo(-e * Math.cos(t), r * Math.sin(t)); }
      g.closePath(); const grd = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.3); grd.addColorStop(0, '#fffbf0'); grd.addColorStop(1, '#d9d2c4'); g.fillStyle = grd; g.fill(); g.restore();
    }
    let last = 0;
    function frame(t) {
      if (visible) {
        if (last && !reduced() && opts.autoRotate !== false && t - lastInteract > 2500) cam.yaw += (t - last) * (opts.backdrop ? 0.00003 : 0.00006);
        draw();
      }
      last = t; raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if ('IntersectionObserver' in root) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    if (!opts.backdrop) {
      // drag to turn (pointer events cover mouse, pen and touch), wheel / two-finger pinch to zoom
      const pts = new Map(); let pinch = 0, moved = 0;
      canvas.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
        pts.set(e.pointerId, [e.clientX, e.clientY]); lastInteract = performance.now();
        if (pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) zoomK = Math.max(0.45, Math.min(2.2, zoomK * (pinch / d))); pinch = d; return;
        }
        moved += Math.abs(dx) + Math.abs(dy);
        cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.15, Math.min(1.5, cam.pitch - dy * 0.005));
      });
      const up = (e) => {
        if (pts.size === 1 && moved < 6 && opts.onTap) {
          const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          let best = null, bd = 44 * 44;
          for (const [k, p] of Object.entries(screen)) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
          opts.onTap(best);
        }
        pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
      };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = 0; });
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); lastInteract = performance.now(); zoomK = Math.max(0.45, Math.min(2.2, zoomK * Math.exp(e.deltaY * 0.001))); }, { passive: false });
      canvas.addEventListener('keydown', (e) => {
        const k = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
        if (k) { e.preventDefault(); lastInteract = performance.now(); cam.yaw += k[0]; cam.pitch = Math.max(0.15, Math.min(1.5, cam.pitch + k[1])); }
        if (e.key === '+' || e.key === '=') zoomK = Math.max(0.45, zoomK * 0.9);
        if (e.key === '-') zoomK = Math.min(2.2, zoomK * 1.1);
      });
    }
    return self;
  }

  /** Sky bodies for a moment, with 70-day retrograde trails like the app. */
  function skyBodies(date, trails = true) {
    const pos = E.all(date);
    return E.BODIES.map((b) => {
      const p = pos[b.key], o = { key: b.key, lon: p.lon, lat: p.lat, retro: p.retro };
      if (trails && p.retro) { o.trail = []; for (let d = -35; d <= 35; d += 2) o.trail.push(E.lonLat(b.key, new Date(date.getTime() + d * 864e5)).lon); }
      return o;
    });
  }

  /* ---------- the chart wheel ---------- */
  function spread(lons, minSep) {
    const n = lons.length; if (n <= 1) return lons.slice();
    const sep = Math.min(minSep, 360 / n), norm = E.norm;
    const idx = [...lons.keys()].sort((a, b) => norm(lons[a]) - norm(lons[b]));
    const sorted = idx.map((i) => norm(lons[i]));
    let startK = 0, widest = -1;
    for (let k = 0; k < n; k++) { const gp = norm(sorted[(k + 1) % n] - sorted[k]); if (gp > widest) { widest = gp; startK = (k + 1) % n; } }
    const order = [...Array(n)].map((_, k) => idx[(startK + k) % n]);
    const pos = order.map((i) => norm(lons[i]));
    for (let k = 1; k < n; k++) while (pos[k] < pos[k - 1]) pos[k] += 360;
    const orig = pos.slice();
    for (let it = 0; it < 100; it++) {
      let changed = false;
      for (let k = 0; k < n;) {
        let j = k; while (j + 1 < n && pos[j + 1] - pos[j] < sep - 1e-9) j++;
        if (j > k) { let mean = 0; for (let m = k; m <= j; m++) mean += orig[m]; mean /= j - k + 1; const first = mean - (sep * (j - k)) / 2; for (let m = k; m <= j; m++) { const v = first + sep * (m - k); if (Math.abs(v - pos[m]) > 1e-9) { pos[m] = v; changed = true; } } }
        k = j + 1;
      }
      for (let m = 1; m < n; m++) if (pos[m] - pos[m - 1] < sep - 1e-9) changed = true;
      if (!changed) break;
    }
    const out = new Array(n); order.forEach((o, k) => (out[o] = norm(pos[k]))); return out;
  }

  /**
   * ChartWheel(canvas, chart, opts): opts.onHit({type:'planet'|'house'|'aspect'|'sign', ...}). .setThreeD(bool) animates
   * the tilt; drag turns the plate in 3D. .highlight(key).
   */
  function ChartWheel(canvas, chart, opts = {}) {
    const cam = new Camera(), tmp = [0, 0, 0];
    const keys = E.BODIES.map((b) => b.key);
    const disp = spread(keys.map((k) => chart.pos[k].lon), 9.5);
    const aspects = chart.aspects.filter((a) => a.a !== 'node' && a.b !== 'node');
    const ascRef = chart.asc != null ? chart.asc : chart.pos.sun.sign.i * 30;
    let tilt = 0, target = 0, spin = 0, hl = null, raf = 0, geo = null;
    const self = {
      setThreeD(on) { target = on ? 1 : 0; if (reduced()) tilt = target; kick(); },
      highlight(k) { hl = k; kick(); },
      stop() { cancelAnimationFrame(raf); }
    };
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16; lastT = t;
      if (Math.abs(target - tilt) > 0.001) tilt += (target - tilt) * Math.min(1, dt / 160); else tilt = target;
      draw();
      if (Math.abs(target - tilt) > 0.001) raf = requestAnimationFrame(loop); else { raf = 0; lastT = 0; }
    }
    function draw() {
      const { g, w, h } = setup(canvas), c = { x: w / 2, y: h / 2 }, r = (Math.min(w, h) / 2) * 0.86;
      g.clearRect(0, 0, w, h);
      cam.fov = 70; cam.distance = 1.9; cam.pitch = 1.02 * tilt; cam.yaw = spin * D2R;
      cam.update(w, h, h * (0.5 + 0.06 * tilt));
      cam.project(1, 0, 0, tmp); const camRim = tmp[0] - cam.cx, k3 = camRim ? r / camRim : 1;
      const ang = (lon) => (180 + (lon - ascRef)) * D2R;
      const at = (rf, lon, z = 0) => {
        const a = ang(lon), fx = c.x + rf * r * Math.cos(a), fy = c.y - rf * r * Math.sin(a);
        if (tilt <= 0.001) return [fx, fy];
        cam.project(rf * Math.cos(a), rf * Math.sin(a), z, tmp);
        const px = cam.cx + (tmp[0] - cam.cx) * k3, py = cam.cy + (tmp[1] - cam.cy) * k3;
        return [fx + (px - fx) * tilt, fy + (py - fy) * tilt];
      };
      const depthScale = (rf, lon) => { if (tilt <= 0.001) return 1; const a = ang(lon), d = cam.project(rf * Math.cos(a), rf * Math.sin(a), 0, tmp); return 1 + (cam.distance / d - 1) * tilt; };
      const path = (rf, z = 0) => { g.beginPath(); for (let k = 0; k <= 144; k++) { const o = at(rf, k * 2.5, z); k ? g.lineTo(o[0], o[1]) : g.moveTo(o[0], o[1]); } };
      const line = (a, b, color, wd, dash) => { g.strokeStyle = color; g.lineWidth = wd; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); if (dash) g.setLineDash([]); };

      if (tilt > 0.05) {
        path(1.04, -0.09); g.closePath(); g.fillStyle = `rgba(0,0,0,${0.45 * tilt})`; g.fill();
        for (let k = 0; k < 144; k++) {
          const l0 = k * 2.5, l1 = (k + 1) * 2.5, a = at(1, l0), b = at(1, l1), a2 = at(1, l0, -0.07), b2 = at(1, l1, -0.07);
          const shade = (0.35 + 0.45 * ((Math.cos(ang(l0) + 0.8) + 1) / 2)) * tilt;
          g.fillStyle = mix('#3b2a12', C.gold, shade * 0.6); g.globalAlpha = tilt;
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b2[0], b2[1]); g.lineTo(a2[0], a2[1]); g.closePath(); g.fill(); g.globalAlpha = 1;
        }
      }
      path(1); g.closePath();
      const plate = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 1.1); plate.addColorStop(0, '#241a38'); plate.addColorStop(0.75, '#181026'); plate.addColorStop(1, '#120d1a');
      g.fillStyle = plate; g.fill();
      for (let s = 0; s < 12; s++) {
        const sign = E.SIGNS[s];
        g.beginPath();
        for (let k = 0; k <= 12; k++) { const o = at(1, s * 30 + k * 2.5); k ? g.lineTo(o[0], o[1]) : g.moveTo(o[0], o[1]); }
        for (let k = 12; k >= 0; k--) { const o = at(0.84, s * 30 + k * 2.5); g.lineTo(o[0], o[1]); }
        g.closePath(); g.fillStyle = rgba(C.element[sign.element], 0.12); g.fill();
        line(at(0.84, s * 30), at(1, s * 30), rgba(C.gold, 0.7), 1.2);
        const gp = at(0.92, s * 30 + 15); glyphAt(g, sign.glyph, gp[0], gp[1], Math.max(10, r * 0.075) * depthScale(0.92, s * 30 + 15), C.gold);
      }
      for (let d = 0; d < 360; d++) {
        if (d % 30 === 0) continue;
        const len = d % 10 === 0 ? 0.04 : d % 5 === 0 ? 0.026 : 0.013;
        line(at(0.84, d), at(0.84 - len, d), rgba(C.gold, d % 5 === 0 ? 0.55 : 0.3), d % 10 === 0 ? 1.1 : 0.7);
      }
      path(1); g.strokeStyle = rgba(C.gold, 0.9); g.lineWidth = 1.6; g.stroke();
      path(0.84); g.strokeStyle = rgba(C.gold, 0.85); g.lineWidth = 1.2; g.stroke();
      path(0.56); g.strokeStyle = C.line; g.lineWidth = 1; g.stroke();
      path(0.42); g.strokeStyle = C.line; g.stroke();
      if (chart.cusps) {
        for (let hh = 0; hh < 12; hh++) {
          const angle = hh % 3 === 0, cu = chart.cusps;
          line(at(0.42, cu[hh]), at(angle ? 0.84 : 0.56, cu[hh]), angle ? C.gold : C.line, angle ? 2.2 : 1);
          const mid = cu[hh] + E.norm(cu[(hh + 1) % 12] - cu[hh]) / 2, o = at(0.49, mid);
          label(g, String(hh + 1), o[0], o[1], Math.max(9, r * 0.045), C.muted);
        }
        [['ASC', 0], ['IC', 3], ['DSC', 6], ['MC', 9]].forEach(([t, i]) => { const o = at(1.06, chart.cusps[i] + 4.5); label(g, t, o[0], o[1], Math.max(9, r * 0.042), C.gold); });
      }
      for (const a of aspects) {
        const strength = Math.max(0.2, Math.min(1, 1 - a.orb / a.type.orb)), on = !hl || a.a === hl || a.b === hl;
        line(at(0.42, chart.pos[a.a].lon), at(0.42, chart.pos[a.b].lon), rgba(C.aspect[a.type.key], (0.35 + 0.55 * strength) * (on ? 1 : 0.15)), (1.1 + 1.8 * strength) * 0.8, a.type.key === 'sextile' ? [7, 6] : null);
      }
      const order = keys.map((_, i) => i).sort((i, j) => {
        if (tilt <= 0) return 0;
        const di = cam.project(0.7 * Math.cos(ang(disp[i])), 0.7 * Math.sin(ang(disp[i])), 0, tmp), dj = cam.project(0.7 * Math.cos(ang(disp[j])), 0.7 * Math.sin(ang(disp[j])), 0, tmp);
        return dj - di;
      });
      const gsize = Math.max(14, r * 0.085);
      for (const i of order) {
        const k = keys[i], p = chart.pos[k], sel = k === hl;
        line(at(0.84, p.lon), at(0.795, p.lon), 'rgba(238,228,211,0.75)', 1.4);
        line(at(0.795, p.lon), at(0.745, disp[i]), 'rgba(238,228,211,0.22)', 0.8);
        const base = at(0.69, disp[i]), sc = depthScale(0.69, disp[i]);
        if (tilt > 0.05) {
          const lift = (0.12 + 0.07 * (i % 3)) * tilt, top = at(0.69, disp[i], lift), rad = r * 0.042 * sc * sc * (0.5 + 0.5 * tilt);
          const sx = base[0] + rad * 0.5, sy = base[1] + rad * 0.15;
          const sh = g.createRadialGradient(sx, sy, 0, sx, sy, rad * 1.4); sh.addColorStop(0, `rgba(0,0,0,${0.6 * tilt})`); sh.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sh; g.beginPath(); g.ellipse(sx, sy, rad * 1.4, rad * 0.5, 0, 0, TAU); g.fill();
          line(base, top, `rgba(90,67,24,${0.9 * tilt})`, 2.2 * sc);
          line([base[0] - 0.6, base[1]], [top[0] - 0.6, top[1]], rgba(C.gold, 0.8 * tilt), 0.8 * sc);
          g.fillStyle = rgba(C.gold, 0.7 * tilt); g.beginPath(); g.arc(base[0], base[1], 1.6 * sc, 0, TAU); g.fill();
          const bc = C.body[k], cx = top[0] - rad * 0.38, cy = top[1] - rad * 0.42, grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.65);
          grd.addColorStop(0, mix(bc, '#ffffff', 0.55)); grd.addColorStop(0.35, bc); grd.addColorStop(0.8, mix(bc, '#000000', 0.6)); grd.addColorStop(1, mix(bc, '#000000', 0.88));
          g.fillStyle = grd; g.beginPath(); g.arc(top[0], top[1], rad, 0, TAU); g.fill();
          g.fillStyle = `rgba(255,255,255,${0.85 * tilt})`; g.beginPath(); g.arc(top[0] - rad * 0.42, top[1] - rad * 0.46, rad * 0.18, 0, TAU); g.fill();
          if (k === 'sun') { const s2 = g.createRadialGradient(top[0], top[1], 0, top[0], top[1], rad * 3); s2.addColorStop(0, 'rgba(255,210,122,0.4)'); s2.addColorStop(1, 'rgba(255,210,122,0)'); g.fillStyle = s2; g.beginPath(); g.arc(top[0], top[1], rad * 3, 0, TAU); g.fill(); }
          if (sel) { g.strokeStyle = C.gold; g.lineWidth = 1.6; g.beginPath(); g.arc(top[0], top[1], rad + 3, 0, TAU); g.stroke(); }
          const gy = top[1] - rad - 10 * sc;
          g.fillStyle = 'rgba(18,13,26,0.8)'; g.beginPath(); g.arc(top[0], gy, 9 * sc, 0, TAU); g.fill();
          glyphAt(g, E.B[k].glyph, top[0], gy, 13 * sc, p.retro ? C.ember : C.text);
        } else {
          if (sel) { g.fillStyle = rgba(C.gold, 0.25); g.beginPath(); g.arc(base[0], base[1], gsize * 0.85, 0, TAU); g.fill(); }
          glyphAt(g, E.B[k].glyph, base[0], base[1], sel ? gsize * 1.15 : gsize, p.retro ? C.ember : sel ? C.gold : C.text);
          const dp = at(0.605, disp[i]);
          label(g, Math.floor(p.degInSign) + '\u00B0' + (p.retro ? '\u211E' : ''), dp[0], dp[1], Math.max(8, r * 0.038), p.retro ? rgba(C.ember, 0.9) : C.muted);
        }
      }
      geo = { c, r };
    }
    // interaction: tap to identify (flat), drag to spin (3D)
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, 0]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - down[0]; down[2] += Math.abs(dx); down[0] = e.clientX; if (target > 0.5) { spin += dx * 0.35; draw(); } });
    canvas.addEventListener('pointerup', (e) => {
      const moved = down && down[2] > 6; down = null;
      if (moved || target > 0.5 || !geo || !opts.onHit) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, { c, r } = geo;
      const dx = x - c.x, dy = y - c.y, dist = Math.hypot(dx, dy);
      const lon = E.norm(ascRef + (Math.atan2(-dy, dx) * 180) / Math.PI - 180);
      if (dist > r * 1.02) return;
      if (dist > r * 0.84) return opts.onHit({ type: 'sign', sign: E.signOf(lon) });
      if (dist > r * 0.56) {
        let best = 0; keys.forEach((_, i) => { if (Math.abs(E.angDiff(disp[i], lon)) < Math.abs(E.angDiff(disp[best], lon))) best = i; });
        if (Math.abs(E.angDiff(disp[best], lon)) < 7) return opts.onHit({ type: 'planet', key: keys[best] });
        if (chart.cusps) return opts.onHit({ type: 'house', n: E.houseOf(lon, chart.cusps) });
        return;
      }
      if (dist > r * 0.42) { if (chart.cusps) opts.onHit({ type: 'house', n: E.houseOf(lon, chart.cusps) }); return; }
      const rr = r * 0.42, pt = (l) => { const a = (180 + (l - ascRef)) * D2R; return [c.x + rr * Math.cos(a), c.y - rr * Math.sin(a)]; };
      const seg = (p, a, b) => { const abx = b[0] - a[0], aby = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / Math.max(1e-3, abx * abx + aby * aby))); return Math.hypot(a[0] + abx * t - p[0], a[1] + aby * t - p[1]); };
      let best = null, bd = 18;
      for (const a of aspects) { const d = seg([x, y], pt(chart.pos[a.a].lon), pt(chart.pos[a.b].lon)); if (d < bd) { bd = d; best = a; } }
      if (best) opts.onHit({ type: 'aspect', aspect: best });
    });
    canvas.addEventListener('keydown', (e) => { if (target > 0.5 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); spin += e.key === 'ArrowLeft' ? -8 : 8; draw(); } });
    const ro = 'ResizeObserver' in root ? new ResizeObserver(() => draw()) : null; if (ro) ro.observe(canvas);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
    draw();
    return self;
  }

  root.BotbSky3D = { Orrery, ChartWheel, skyBodies, spread, Camera, colors: C };
})(typeof window !== 'undefined' ? window : globalThis);
