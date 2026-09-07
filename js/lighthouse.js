/**
 * Procedural storm-lighthouse scene.
 * Fully deterministic for a given time `t` (seconds) so the same frame can be
 * re-rendered for the "pristine reference" and the degraded stream.
 */

const TAU = Math.PI * 2;

function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * When > 0 every animation rate in this module is snapped to a whole harmonic of
 * PERIOD seconds, which makes the entire scene repeat *exactly* every PERIOD.
 * The game needs that: its score is the mean fidelity over one storm cycle, and
 * a mean is only stable if the footage being scored is identical each cycle.
 * The cinematic intro leaves it at 0 and keeps the freer, never-repeating motion.
 */
let PERIOD = 0;

/** Snap an angular rate (rad/s) so sin(t * r) closes exactly on the period. */
function rate(r) {
  if (!PERIOD) return r;
  return Math.max(1, Math.round(r * PERIOD / TAU)) * TAU / PERIOD;
}

/** Snap a linear speed so (t * v) % span wraps a whole number of times. */
function drift(v, span) {
  if (!PERIOD) return v;
  return Math.max(1, Math.round(v * PERIOD / span)) * span / PERIOD;
}

/** Snap a cycle length (seconds) so it divides the period exactly. */
function cycle(p) {
  if (!PERIOD) return p;
  return PERIOD / Math.max(1, Math.round(PERIOD / p));
}

/** 0..1 storm-lightning envelope; sharp attack, fast decay, irregular spacing. */
export function lightningLevel(t) {
  let level = 0;
  for (let i = 0; i < 4; i++) {
    const period = cycle(6.5 + hash(i * 3.7) * 7.5);
    const phase = hash(i * 9.1) * period;
    const local = (t + phase) % period;
    if (local < 0.45) {
      const flicker = local < 0.09 ? 1 : local < 0.16 ? 0.35 : local < 0.24 ? 0.8 : 0;
      level = Math.max(level, flicker * (1 - local / 0.45));
    }
  }
  return level;
}

function drawSky(ctx, w, h, t, flash) {
  const horizon = h * 0.60;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#03060b');
  g.addColorStop(0.45, '#071019');
  g.addColorStop(0.8, '#0c1b28');
  g.addColorStop(1, '#122c3c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon + 1);

  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 1.7) * w;
    const y = hash(i * 4.3) * horizon * 0.7;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * rate(0.6 + hash(i) * 1.8) + i));
    ctx.fillStyle = `rgba(200,225,255,${0.10 + tw * 0.22})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const speed = drift(6 + hash(i * 2.9) * 16, w * 1.6);
    const x = ((hash(i * 5.5) * w * 1.6) + t * speed) % (w * 1.6) - w * 0.3;
    const y = horizon * (0.06 + hash(i * 7.1) * 0.62);
    const r = w * (0.10 + hash(i * 3.3) * 0.20);
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const lum = 26 + flash * 150;
    cg.addColorStop(0, `rgba(${lum * 0.8 | 0},${lum | 0},${(lum * 1.35) | 0},${0.5 + flash * 0.4})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.42, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBolt(ctx, w, h, t, flash) {
  if (flash < 0.55) return;
  const seed = Math.floor(t / cycle(3.1));
  let x = hash(seed * 2.3) * w * 0.8 + w * 0.1;
  let y = 0;
  ctx.save();
  ctx.strokeStyle = `rgba(210,235,255,${flash})`;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(160,210,255,.95)';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i < 12; i++) {
    x += (hash(seed * 7 + i) - 0.5) * w * 0.09;
    y += h * 0.05;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSea(ctx, w, h, t, flash) {
  const horizon = h * 0.60;
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, '#0d2433');
  g.addColorStop(0.35, '#07161f');
  g.addColorStop(1, '#030a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);

  const layers = 6;
  for (let L = 0; L < layers; L++) {
    const p = L / (layers - 1);
    const base = horizon + (h - horizon) * (p * p * 0.95 + 0.02);
    const amp = 3 + p * h * 0.045;
    const speed = 0.5 + p * 2.2;
    const r1 = rate(speed), r2 = rate(speed * 1.7), r3 = rate(speed * 0.5);
    const alpha = 0.10 + p * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, base);
    for (let x = 0; x <= w; x += 8) {
      const y = base
        + Math.sin(x * 0.011 + t * r1 + L) * amp
        + Math.sin(x * 0.027 - t * r2 + L * 2.1) * amp * 0.45
        + Math.sin(x * 0.005 + t * r3) * amp * 0.8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const lum = 18 + flash * 90;
    ctx.fillStyle = `rgba(${lum * 0.5 | 0},${lum | 0},${lum * 1.5 | 0},${alpha + flash * 0.15})`;
    ctx.fill();

    if (L > 2) {
      ctx.strokeStyle = `rgba(190,225,240,${0.05 + p * 0.16})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawTower(ctx, w, h, t, flash) {
  const horizon = h * 0.60;
  const cx = w * 0.70;
  const baseY = horizon + (h - horizon) * 0.42;
  const towerH = h * 0.44;
  const topY = baseY - towerH;
  const halfBot = w * 0.036;
  const halfTop = w * 0.021;

  ctx.beginPath();
  ctx.moveTo(cx - halfBot * 3.1, baseY + h * 0.085);
  ctx.lineTo(cx - halfBot * 1.7, baseY - h * 0.012);
  ctx.lineTo(cx - halfBot * 0.5, baseY + h * 0.004);
  ctx.lineTo(cx + halfBot * 1.5, baseY - h * 0.008);
  ctx.lineTo(cx + halfBot * 3.0, baseY + h * 0.09);
  ctx.closePath();
  ctx.fillStyle = '#050b11';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - halfBot, baseY);
  ctx.lineTo(cx - halfTop, topY);
  ctx.lineTo(cx + halfTop, topY);
  ctx.lineTo(cx + halfBot, baseY);
  ctx.closePath();
  const tg = ctx.createLinearGradient(cx - halfBot, 0, cx + halfBot, 0);
  const lum = 30 + flash * 120;
  tg.addColorStop(0, `rgb(${lum * 0.35 | 0},${lum * 0.5 | 0},${lum * 0.65 | 0})`);
  tg.addColorStop(0.45, `rgb(${lum | 0},${lum * 1.1 | 0},${lum * 1.2 | 0})`);
  tg.addColorStop(1, `rgb(${lum * 0.25 | 0},${lum * 0.35 | 0},${lum * 0.48 | 0})`);
  ctx.fillStyle = tg;
  ctx.fill();

  ctx.save();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const y0 = topY + (towerH / 4) * i + towerH * 0.06;
    ctx.fillStyle = `rgba(${120 + flash * 120 | 0},${34 + flash * 60 | 0},${44 + flash * 60 | 0},.55)`;
    ctx.fillRect(cx - halfBot * 1.2, y0, halfBot * 2.4, towerH * 0.11);
  }
  ctx.restore();

  ctx.fillStyle = `rgb(${18 + flash * 80 | 0},${26 + flash * 80 | 0},${34 + flash * 80 | 0})`;
  ctx.fillRect(cx - halfTop * 1.55, topY - h * 0.012, halfTop * 3.1, h * 0.014);
  const lampY = topY - h * 0.045;
  ctx.fillStyle = 'rgba(12,20,28,.95)';
  ctx.fillRect(cx - halfTop * 1.15, lampY, halfTop * 2.3, h * 0.034);
  ctx.beginPath();
  ctx.moveTo(cx - halfTop * 1.5, lampY);
  ctx.lineTo(cx, lampY - h * 0.028);
  ctx.lineTo(cx + halfTop * 1.5, lampY);
  ctx.closePath();
  ctx.fillStyle = `rgb(${16 + flash * 70 | 0},${24 + flash * 70 | 0},${32 + flash * 70 | 0})`;
  ctx.fill();

  return { cx, lampY: lampY + h * 0.016, lampR: halfTop };
}

function drawBeacon(ctx, w, h, t, lamp) {
  const { cx, lampY } = lamp;
  const ang = (t * rate(1.05)) % TAU;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let k = 0; k < 2; k++) {
    const a = ang + k * Math.PI;
    const facing = Math.sin(a);
    const spread = 0.16;
    const len = w * 1.25;
    const strength = Math.max(0, (facing + 0.35) / 1.35);
    if (strength <= 0.01) continue;

    ctx.save();
    ctx.translate(cx, lampY);
    const dir = Math.cos(a) * 1.35;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir * len - len * spread * 0.25, -h * 0.18 - len * spread);
    ctx.lineTo(dir * len + len * spread * 0.25, -h * 0.18 + len * spread);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, 0, dir * len, 0);
    cg.addColorStop(0, `rgba(255,232,180,${0.30 * strength})`);
    cg.addColorStop(0.5, `rgba(255,214,140,${0.12 * strength})`);
    cg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.restore();
  }

  const glow = 0.45 + 0.55 * Math.max(0, Math.sin(ang));
  const r = w * 0.085 * (0.6 + glow * 0.7);
  const gg = ctx.createRadialGradient(cx, lampY, 0, cx, lampY, r);
  gg.addColorStop(0, `rgba(255,244,214,${0.85 * glow})`);
  gg.addColorStop(0.25, `rgba(255,206,128,${0.35 * glow})`);
  gg.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(cx, lampY, r, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16 + 0.2 * glow;
  const rg = ctx.createLinearGradient(0, h * 0.62, 0, h);
  rg.addColorStop(0, 'rgba(255,205,130,.55)');
  rg.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(cx - w * 0.10, h * 0.62, w * 0.20, h * 0.38);
  ctx.restore();
}

function drawRain(ctx, w, h, t, wind) {
  ctx.save();
  ctx.strokeStyle = 'rgba(175,205,230,.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const slant = 0.28 + wind * 0.75;
  // Horizontal drift must not track the live wind, or the streak positions stop
  // being a pure function of t and the scene can never repeat.
  const slantV = PERIOD ? 0.655 : slant;
  for (let i = 0; i < 170; i++) {
    const speed = 480 + hash(i * 3.1) * 620;
    const vy = drift(speed, h + 60);
    const vx = drift(speed * slantV * 0.55, w * 1.5);
    const x0 = (hash(i) * w * 1.5 - t * vx) % (w * 1.5);
    const y0 = (hash(i * 2.7) * h + t * vy) % (h + 60) - 30;
    const len = 9 + hash(i * 5.9) * 20;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + len * slant, y0 + len);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSpray(ctx, w, h, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const period = cycle(3.2 + hash(i * 8.3) * 3.5);
    const local = (t + hash(i * 2.2) * period) % period;
    if (local > 1.1) continue;
    const p = local / 1.1;
    const x = w * (0.10 + hash(i * 6.1) * 0.82);
    const y = h * 0.72 - Math.sin(p * Math.PI) * h * 0.24;
    const r = w * (0.03 + p * 0.075);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(200,225,240,${0.22 * (1 - p)})`);
    g.addColorStop(1, 'rgba(200,225,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Render one deterministic frame of the storm scene.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w @param {number} h @param {number} t seconds
 * @param {{wind?:number, vignette?:boolean, period?:number}} [opts]
 *   `period` (seconds) makes every animation repeat exactly on that interval.
 */
export function drawScene(ctx, w, h, t, opts = {}) {
  PERIOD = opts.period ?? 0;
  const wind = opts.wind ?? 0.5;
  const flash = lightningLevel(t);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawSky(ctx, w, h, t, flash);
  drawBolt(ctx, w, h, t, flash);
  drawSea(ctx, w, h, t, flash);
  const lamp = drawTower(ctx, w, h, t, flash);
  drawBeacon(ctx, w, h, t, lamp);
  drawSpray(ctx, w, h, t);
  drawRain(ctx, w, h, t, wind);

  if (flash > 0.02) {
    ctx.fillStyle = `rgba(180,210,255,${flash * 0.13})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (opts.vignette !== false) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
