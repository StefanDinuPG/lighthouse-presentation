import { drawScene } from './lighthouse.js';
import { boardHTML } from './board.js';

/* ----------------------------------------------------------- dimensions */

const SRC_W = 960, SRC_H = 540;   // pristine render
const OUT_W = 640, OUT_H = 360;   // transmitted / displayed buffer
const RING_N = 60;                // ~1s of history at 60fps
const CMP_W = 320, CMP_H = 180;   // fidelity comparison sampling
const BLK = 20;                   // pooling block size for the structural terms

/** label -> [internal width, internal height, bitrate-height] */
const RES_LADDER = {
  144: [160, 90, 144],
  240: [256, 144, 240],
  360: [384, 216, 360],
  480: [512, 288, 480],
  720: [640, 360, 720],
  1080: [640, 360, 1080], // the sensor cannot resolve more — pure waste
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const escapeHTML = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Length of one storm cycle, in seconds.
 *
 * The weather is built to repeat EXACTLY on this period (see `pnoise`) and the
 * per-cycle RNG is re-seeded on every boundary. That gives the scoring model the
 * one property it cannot work without: any window of exactly one cycle contains
 * exactly the same storm. So a full-cycle average is
 *   - stable  (it does not drift as the window slides), and
 *   - fair    (two settings are graded against identical weather).
 */
const CYCLE_S = 20;

/** Fixed seed so every cycle replays the same gusts, outages and hail. */
const STORM_SEED = 0x5EA1;

/**
 * Smooth pseudo-noise in 0..1 that repeats exactly every CYCLE_S seconds.
 * Only integer harmonics of the cycle are used, so there is no beat frequency
 * and no drift — unlike a sum of incommensurate sines, which never repeats.
 */
function pnoise(t, seed, harmonic = 1) {
  const w = (2 * Math.PI * harmonic) / CYCLE_S;
  return 0.5 + 0.5 * (
    0.58 * Math.sin(t * w + seed) +
    0.30 * Math.sin(t * w * 3 + seed * 2.7) +
    0.12 * Math.sin(t * w * 6 + seed * 5.1));
}

/** Phase offsets chosen so the round opens in the calm trough of the cycle. */
const WIND_PHASE = -Math.PI / 2;
const HAIL_PHASE = -Math.PI / 2 - 1.1;

/**
 * Phase (seconds into the cycle) of the gale peak. One dropout is scheduled
 * here every cycle: making it deterministic is what stops the score from
 * jumping, because an outage is worth several points of fidelity and a
 * probabilistic one would land in some measurement windows but not others.
 */
const OUTAGE_PHASE = 7.05;

/** Small, fast, seedable PRNG — lets a cycle replay identically. */
function mulberry32(a) {
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- controls */

const GROUPS = [
  {
    title: 'PART 1 · THE PIPELINE',
    items: [
      {
        id: 'compute', kind: 'select', label: 'Compute placement', def: 'none',
        options: [['none', 'None — ship every frame'], ['edge', 'Edge ML gate (on-tower NPU)'], ['cloud', 'Cloud AI (full-res mandate)']],
        hint: 'Edge gating cuts uplink ~45% and adds ~35 ms. Cloud inference costs +15% uplink and ~95 ms. The saving is what pays for everything else on this dashboard.',
      },
      {
        id: 'transport', kind: 'select', label: 'Transport', def: 'udp',
        options: [['udp', 'UDP — lossy, live'], ['tcp', 'TCP — reliable, ordered']],
        hint: 'TCP repairs loss but retransmits stall the feed (head-of-line blocking) and cost latency.',
      },
      {
        id: 'checksum', kind: 'toggle', label: 'Datagram checksum', def: true,
        hint: 'On: damaged datagrams are discarded (stale block). Off: corrupt bytes reach the decoder as garbage.',
      },
      {
        id: 'jitterBuf', kind: 'range', label: 'Jitter buffer', min: 0, max: 800, step: 20, def: 120,
        fmt: v => `${v} ms`,
        hint: 'Absorbs reordering and wind-induced jitter. Cheap up to ~350 ms; past that the mainland is watching history.',
      },
      {
        id: 'reconnect', kind: 'select', label: 'Reconnect strategy', def: 'expo',
        options: [['aggressive', 'Aggressive — 100 ms retry'], ['linear', 'Linear backoff'], ['expo', 'Exponential + jitter']],
        hint: 'Aggressive retries congest the shared ingest tier and lengthen every outage.',
      },
      {
        id: 'fec', kind: 'range', label: 'FEC redundancy', min: 0, max: 50, step: 5, def: 0,
        fmt: v => `${v} %`,
        hint: 'Ships redundant parity shards so the receiver rebuilds lost packets itself — no retransmit, no round trip. Overhead is permanent: 20% FEC costs 20% of your link on a calm day too. And parity rides the same queue as the payload, so it repairs storm loss but never congestion — buy headroom first, then buy redundancy.',
      },
      {
        id: 'txpower', kind: 'range', label: 'TX amplifier power', min: 50, max: 130, step: 5, def: 100,
        fmt: v => `${v} %`,
        hint: 'More power buys link capacity in a storm and drains the battery faster. Worth points only while it is keeping you under the cap — past that it is pure drain. The radio is the power budget.',
      },
    ],
  },
  {
    title: 'PART 2 · THE PAYLOAD',
    items: [
      {
        id: 'resolution', kind: 'select', label: 'Spatial resolution', def: '720',
        options: [['144', '144p'], ['240', '240p'], ['360', '360p'], ['480', '480p'], ['720', '720p — sensor native'], ['1080', '1080p — upsampled']],
        hint: 'The sensor tops out at 720p. 1080p costs 2.3× the bits and carries no extra truth.',
      },
      {
        id: 'fps', kind: 'range', label: 'Frame rate', min: 1, max: 30, step: 1, def: 30,
        fmt: v => `${v} fps`,
        hint: 'Temporal resolution. Fewer frames means less airtime, less battery — and a staler picture.',
      },
      {
        id: 'gop', kind: 'range', label: 'Keyframe interval (GOP)', min: 1, max: 120, step: 1, def: 60,
        fmt: v => `${v} f`,
        hint: 'Frames between I-frames. Short GOP clears corruption fast and costs bitrate.',
      },
      {
        id: 'pframes', kind: 'toggle', label: 'P-frame prediction', def: true,
        hint: 'Off = all-intra: corruption never propagates, at roughly 8× the bitrate.',
      },
      {
        id: 'rate', kind: 'select', label: 'Rate control', def: 'vbr',
        options: [['vbr', 'VBR — quality locked, bitrate floats'], ['cbr', 'CBR — bitrate locked, quality floats']],
        hint: 'VBR spends whatever the scene needs, so hail can spike you through the cap. CBR can never breach the cap — it hits the target by throwing away detail instead.',
      },
      {
        id: 'denoise', kind: 'range', label: 'Pre-process denoise', min: 0, max: 100, step: 5, def: 0,
        fmt: v => `${v} %`,
        hint: 'Strips incompressible sensor noise before the encoder. Too much and you blur away the signal.',
      },
      {
        id: 'lamp', kind: 'toggle', label: 'Dim navigation lamp', def: false,
        hint: 'Sheds a few watts of LED load. Feels decisive. Barely moves the battery — the radio is the problem.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ game */

export class FixThatStream {
  constructor(root, opts = {}) {
    this.root = root;
    this.cfg = {};
    for (const g of GROUPS) for (const it of g.items) this.cfg[it.id] = it.def;

    // When a room is supplied the console belongs to one player for the whole
    // round: no hand-over, no local run list, and the result goes to the room.
    this.net = opts.net || null;
    this.onSubmit = opts.onSubmit || null;
    this.networked = !!this.net;
    this.sharedRows = [];
    this.sharedRevealed = false;

    this.raf = 0;
    this.destroyed = false;
    this.ended = false;
    this.showRef = true;
    this.batteryEnabled = true;
    this.rounds = [];
    this.runCounter = 0;
    this.currentEntry = null;

    this.buildDOM();
    this.buildCanvases();
    this.resetState();
  }

  /* -------------------------------------------------------------- DOM */

  buildDOM() {
    const metric = (id, lbl, unit) => `
      <div class="metric" id="m-${id}">
        <div class="lbl"><span>${lbl}</span><span id="m-${id}-sub"></span></div>
        <div class="val"><span id="m-${id}-v">—</span><small>${unit}</small></div>
        <div class="bar"><i id="m-${id}-b"></i></div>
      </div>`;

    // The score panel is the one number that decides the winner, so it gets its
    // own treatment: the settled full-cycle reading, the best reading so far,
    // a progress bar for the wait, and a sparkline of the round.
    const scorePanel = `
      <div class="metric score measuring" id="m-score">
        <div class="lbl"><span>Round score</span><span id="m-score-state"></span></div>
        <div class="val"><span id="m-score-v">—</span><small>%</small></div>
        <div class="bar"><i id="m-score-b"></i></div>
        <div class="scorebest" id="m-score-best"></div>
        <canvas class="spark" id="m-score-spark" width="520" height="60"></canvas>
      </div>`;

    const ctlHTML = it => {
      if (it.kind === 'select') {
        return `<div class="ctl">
          <label for="c-${it.id}">${it.label}</label>
          <select id="c-${it.id}" data-id="${it.id}">
            ${it.options.map(([v, l]) => `<option value="${v}" ${v === it.def ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <div class="hint">${it.hint}</div></div>`;
      }
      if (it.kind === 'range') {
        return `<div class="ctl">
          <label for="c-${it.id}">${it.label}<span class="v" id="v-${it.id}">${it.fmt(it.def)}</span></label>
          <input type="range" id="c-${it.id}" data-id="${it.id}" min="${it.min}" max="${it.max}" step="${it.step}" value="${it.def}"/>
          <div class="hint">${it.hint}</div></div>`;
      }
      return `<div class="ctl">
        <label class="toggle" for="c-${it.id}">${it.label}
          <input type="checkbox" id="c-${it.id}" data-id="${it.id}" ${it.def ? 'checked' : ''}/></label>
        <div class="hint">${it.hint}</div></div>`;
    };

    this.root.innerHTML = `
      <div class="game">
        <div class="game-metrics">
          ${scorePanel}
          ${metric('fid', 'Live fidelity', '%')}
          ${metric('bw', 'Bandwidth', '%')}
          ${metric('lat', 'Glass-to-glass', 'ms')}
          ${metric('loss', 'Packet loss', '%')}
          ${metric('bat', 'Battery', '%')}
        </div>

        <div class="viewports dual" id="viewports">
          <div class="vp live">
            <span class="tag">● OPS CENTRE — RECEIVED STREAM</span>
            <span class="wx" id="wx"></span>
            <canvas id="cv-stream" width="${OUT_W}" height="${OUT_H}"></canvas>
            <div class="alert" id="alert"></div>
          </div>
          <div class="vp" id="vp-ref">
            <span class="tag">PRISTINE SENSOR FEED — REFERENCE</span>
            <span class="wx fidbreak" id="fidbreak"></span>
            <canvas id="cv-ref" width="${OUT_W}" height="${OUT_H}"></canvas>
          </div>
        </div>

        <aside class="dash" id="dash">
          <div class="dash-head"><span>UPLINK CONSOLE · LK-114</span><span id="dash-state">LIVE</span></div>
          ${GROUPS.map(g => `<div class="dash-group"><h4>${g.title}</h4>${g.items.map(ctlHTML).join('')}</div>`).join('')}
          <div class="dash-group" style="border-bottom:0">
            <h4>PRESENTER</h4>
            <div class="hint" style="line-height:1.6">
              <kbd>ENTER</kbd> end round &amp; lock · <kbd>R</kbd> restart ·
              <kbd>V</kbd> reference feed · <kbd>B</kbd> battery drain
            </div>
          </div>
        </aside>
      </div>
      <video id="src-video" playsinline muted loop preload="auto" style="display:none"></video>`;

    this.el = {
      dash: this.root.querySelector('#dash'),
      dashState: this.root.querySelector('#dash-state'),
      viewports: this.root.querySelector('#viewports'),
      vpRef: this.root.querySelector('#vp-ref'),
      alert: this.root.querySelector('#alert'),
      wx: this.root.querySelector('#wx'),
      fidbreak: this.root.querySelector('#fidbreak'),
      stream: this.root.querySelector('#cv-stream'),
      ref: this.root.querySelector('#cv-ref'),
      video: this.root.querySelector('#src-video'),
    };
    for (const k of ['bw', 'fid', 'lat', 'loss', 'bat']) {
      this.el[k] = this.root.querySelector(`#m-${k}`);
      this.el[k + 'v'] = this.root.querySelector(`#m-${k}-v`);
      this.el[k + 'b'] = this.root.querySelector(`#m-${k}-b`);
      this.el[k + 's'] = this.root.querySelector(`#m-${k}-sub`);
    }
    this.el.score = this.root.querySelector('#m-score');
    this.el.scorev = this.root.querySelector('#m-score-v');
    this.el.scoreb = this.root.querySelector('#m-score-b');
    this.el.scorestate = this.root.querySelector('#m-score-state');
    this.el.scorebest = this.root.querySelector('#m-score-best');
    this.el.spark = this.root.querySelector('#m-score-spark');
    this.sparkCtx = this.el.spark.getContext('2d');

    this.onInput = e => {
      const id = e.target.dataset.id;
      if (!id) return;
      const item = GROUPS.flatMap(g => g.items).find(i => i.id === id);
      const before = this.cfg[id];
      if (item.kind === 'toggle') this.cfg[id] = e.target.checked;
      else if (item.kind === 'range') {
        this.cfg[id] = Number(e.target.value);
        this.root.querySelector(`#v-${id}`).textContent = item.fmt(this.cfg[id]);
      } else this.cfg[id] = e.target.value;
      if (this.cfg[id] !== before) this.noteChange();
    };
    this.el.dash.addEventListener('input', this.onInput);
    this.el.dash.addEventListener('change', this.onInput);

    // optional real clip; falls back to the procedural scene if absent
    this.useVideo = false;
    const v = this.el.video;
    v.addEventListener('canplay', () => { this.useVideo = true; v.play().catch(() => { this.useVideo = false; }); });
    v.addEventListener('error', () => { this.useVideo = false; });
    v.src = 'assets/lighthouse.mp4';
  }

  buildCanvases() {
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    };
    this.src = mk(SRC_W, SRC_H);
    this.srcCtx = this.src.getContext('2d');

    this.ring = Array.from({ length: RING_N }, () => mk(OUT_W, OUT_H));
    this.ringCtx = this.ring.map(c => c.getContext('2d'));
    this.head = 0;

    this.scale = mk(OUT_W, OUT_H);
    this.scaleCtx = this.scale.getContext('2d');

    this.work = mk(OUT_W, OUT_H);
    this.workCtx = this.work.getContext('2d', { willReadFrequently: true });

    this.cmpA = mk(CMP_W, CMP_H); this.cmpACtx = this.cmpA.getContext('2d', { willReadFrequently: true });
    this.cmpB = mk(CMP_W, CMP_H); this.cmpBCtx = this.cmpB.getContext('2d', { willReadFrequently: true });
    const N = CMP_W * CMP_H;
    this.ga = new Uint8Array(N); this.gb = new Uint8Array(N);
    this.pa = new Uint8Array(N); this.pb = new Uint8Array(N);
    const NB = Math.ceil(CMP_W / BLK) * Math.ceil(CMP_H / BLK);
    this.blkGA = new Float32Array(NB); this.blkGB = new Float32Array(NB);
    this.blkMA = new Float32Array(NB); this.blkMB = new Float32Array(NB);

    this.streamCtx = this.el.stream.getContext('2d', { willReadFrequently: true });
    this.refCtx = this.el.ref.getContext('2d');
  }

  resetState() {
    this.t0 = performance.now();
    this.last = this.t0;
    this.t = 0;
    this.frameAcc = 0;
    this.frameNo = 0;
    this.blocks = [];
    this.battery = 100;
    this.outage = 0;
    this.wind = 0.4;
    this.hail = 0;
    this.fidInstant = 0;
    this.fidEMA = 0;
    this.fidReady = false;
    this.stall = 0;
    this.lastDelivery = 0;
    this.refEnergyEMA = 0;
    this.prevReady = false;
    this.terms = null;
    this.fidSum = 0;
    this.fidSamples = 0;
    this.rng = mulberry32(STORM_SEED);
    this.cycleIdx = 0;
    this.outageCycle = -1;
    // --- per-configuration scoring -----------------------------------------
    // `window` holds exactly one storm cycle of fidelity samples. Its mean is
    // the score for whatever settings were in force for that whole cycle.
    this.window = [];
    this.lastChange = CYCLE_S * 0.6; // the storm front finishes rolling in here
    this.changes = 0;        // a reading only counts once the user has tuned something
    this.stable = null;      // last completed full-cycle reading
    this.best = null;        // highest completed reading made after a change
    this.bestCfg = null;
    this.spark = [];         // whole-round live-fidelity history for the sparkline
    this.sparkAcc = 0;
    this.sparkEvery = 0.5;   // seconds per sparkline sample (doubles as the round runs)
    this.bwSum = 0; this.bwSamples = 0;
    this.breachTime = 0;
    this.peakBw = 0;
    this.cmpTick = 0;
    this.workCtx.fillStyle = '#000';
    this.workCtx.fillRect(0, 0, OUT_W, OUT_H);
    // Prime the pipeline so the console never opens on a black rectangle.
    this.renderSource();
    for (let i = 0; i < RING_N; i++) this.pushRing();
    this.workCtx.drawImage(this.src, 0, 0, OUT_W, OUT_H);
    this.streamCtx.drawImage(this.work, 0, 0, OUT_W, OUT_H);
    this.refCtx.drawImage(this.src, 0, 0, OUT_W, OUT_H);
  }

  /* ------------------------------------------------------------ weather */

  updateWeather(dt) {
    const t = this.t;
    // The front rolls in once, during the opening (unscored) cycle, so the room
    // sees a clean baseline first. It is fully ramped long before the first
    // scored window opens, so it never skews a measurement.
    const ramp = clamp(t / (CYCLE_S * 0.6), 0.12, 1);
    const gust = Math.pow(pnoise(t, WIND_PHASE + 4.2, 2), 3);
    this.wind = clamp((pnoise(t, WIND_PHASE, 1) * 0.82 + gust * 0.55) * ramp, 0.05, 1);

    const h = pnoise(t, HAIL_PHASE, 1);
    const burst = Math.pow(clamp((h - 0.44) / 0.56, 0, 1), 1.7);
    this.hail = clamp(burst * (0.55 + 0.65 * pnoise(t, HAIL_PHASE + 2.6, 4)) * ramp, 0, 1);

    // Exactly one dropout per cycle, at the peak of the gale, so every scored
    // window contains exactly one. The reconnect strategy decides only how long
    // the tower stays dark — which is the whole of S1's lesson.
    this.outage = Math.max(0, this.outage - dt);
    if (t % CYCLE_S >= OUTAGE_PHASE && this.outageCycle !== this.cycleIdx) {
      this.outageCycle = this.cycleIdx;
      this.outage = { aggressive: 3.2, linear: 2.0, expo: 0.9 }[this.cfg.reconnect];
    }
  }

  /* ------------------------------------------------------------ metrics */

  computeMetrics() {
    const c = this.cfg;
    const [, , bwH] = RES_LADDER[c.resolution];
    const resFactor = Math.pow(bwH / 720, 1.3);
    const fpsFactor = Math.pow(c.fps / 30, 0.75);
    const gopEff = c.pframes ? c.gop : 1;
    const gopFactor = ((gopEff + 7) / gopEff) / (67 / 60);

    const denoise = c.denoise / 100;
    const rawNoise = this.hail * 0.9 + this.wind * 0.25 + 0.35; // night-vision gain floor
    const noiseFactor = 1 + 0.55 * rawNoise * (1 - denoise * 0.85);
    const blurSaving = 1 - 0.28 * denoise;
    const fecFactor = 1 + c.fec / 100;
    const computeFactor = c.compute === 'edge' ? 0.55 : c.compute === 'cloud' ? 1.15 : 1;

    const physicalLoss = this.wind * 0.17 + this.hail * 0.10
      + (c.reconnect === 'aggressive' ? 0.05 : c.reconnect === 'linear' ? 0.015 : 0);
    const protoFactor = c.transport === 'tcp' ? 1.14 + 0.7 * physicalLoss : 1.02;

    const base = 2.2 * resFactor * fpsFactor * gopFactor * blurSaving * fecFactor * protoFactor * computeFactor;
    const wanted = base * noiseFactor;
    const cbrTarget = base * 1.18;
    const bitrate = c.rate === 'cbr' ? Math.min(wanted, cbrTarget) : wanted;
    // CBR pays for noise by throwing detail away
    const quant = c.rate === 'cbr' ? clamp((wanted - bitrate) / Math.max(wanted, 0.01), 0, 0.8) : 0;

    const brownout = this.batteryEnabled && this.battery < 15 ? 0.6 : 1;
    const capacity = Math.max(0.35, 6.2 * (1 - 0.60 * this.wind) * Math.pow(c.txpower / 100, 0.6) * brownout);

    const bwPct = bitrate / capacity * 100;

    // --- loss ---------------------------------------------------------------
    // Order matters here, and it is the whole balance of the game.
    //
    // Overrunning the link is punished steeply and cannot be bought off. FEC
    // repairs PHYSICAL loss — parity shards let the receiver rebuild packets the
    // storm knocked out — but those shards ride the same queue as the data. Once
    // that queue overflows they are dropped alongside what they were meant to
    // protect, so redundancy you cannot afford to send protects nothing. FEC
    // overhead also feeds straight back into bwPct, which makes it self-limiting.
    //
    // Net effect: the 100% cap is genuinely hard. No setting buys you out of
    // breaching it. The only cure is to want fewer bits — which is what edge
    // gating, a coarser resolution and a lower frame rate are for.
    const congestion = clamp(Math.max(0, bwPct - 100) / 45, 0, 0.90);
    const fecEff = (c.fec / 100) * (1 - congestion);

    let loss = clamp(physicalLoss, 0, 0.96);
    loss = clamp(loss - Math.min(loss, fecEff * 1.3) * 0.85, 0, 0.96);
    loss = clamp(loss + congestion, 0, 0.96);

    const lossPreTcp = loss;
    if (c.transport === 'tcp') loss *= 0.14;

    const jitterMs = this.wind * 420 + this.hail * 120;
    const unabsorbed = Math.max(0, jitterMs - c.jitterBuf);

    const latency = 24 + c.jitterBuf
      + (c.compute === 'edge' ? 35 : c.compute === 'cloud' ? 95 : 0)
      + (c.transport === 'tcp' ? 45 + 900 * lossPreTcp : 0)
      + c.fec * 0.6 + (1000 / c.fps) * 0.5 + (c.rate === 'cbr' ? 15 : 0)
      // Bufferbloat: bits you cannot send do not evaporate, they queue. Pushing
      // past the cap costs mounting delay as well as drops, which is why a
      // saturated link feels laggy long before it looks broken.
      + congestion * 950;

    const drain = 0.010
      + 0.115 * (bitrate / 6.2) * (c.txpower / 100)
      + (c.compute === 'cloud' ? 0.012 : c.compute === 'edge' ? 0.006 : 0)
      + (c.lamp ? 0.004 : 0.010);

    // Alignment of the "pristine reference" the stream is graded against.
    //
    // It tracks the delay the operator DELIBERATELY signed up for — buffer depth,
    // compute placement, frame pacing — so choosing any of those is not scored as
    // an error in itself. Involuntary delay is deliberately NOT aligned out:
    // bufferbloat from overrunning the cap and TCP retransmit stalls leave the
    // picture genuinely out of step with reality, and land on the accuracy and
    // motion terms as the real error they are.
    //
    // This is the S2 lesson made mechanical: a buffer is never punished for being
    // a buffer, only for going stale — which is rspTerm's job, not this one.
    const involuntary = congestion * 950 + (c.transport === 'tcp' ? 900 * lossPreTcp : 0);
    const refDelay = clamp(latency - involuntary, 0, 900);

    return {
      bitrate, capacity, bwPct, loss, lossPreTcp, latency, drain, quant, gopEff,
      unabsorbed, saturated: bwPct > 100, denoise, fecEff, congestion, refDelay,
    };
  }

  /* ------------------------------------------------------------ pipeline */

  renderSource() {
    if (this.useVideo && this.el.video.readyState >= 2) {
      const v = this.el.video;
      const s = Math.max(SRC_W / v.videoWidth, SRC_H / v.videoHeight);
      const w = v.videoWidth * s, h = v.videoHeight * s;
      try {
        this.srcCtx.drawImage(v, (SRC_W - w) / 2, (SRC_H - h) / 2, w, h);
        return;
      } catch { this.useVideo = false; }
    }
    drawScene(this.srcCtx, SRC_W, SRC_H, this.t, { wind: this.wind, period: CYCLE_S });
  }

  pushRing() {
    this.head = (this.head + 1) % RING_N;
    const ctx = this.ringCtx[this.head];
    ctx.drawImage(this.src, 0, 0, OUT_W, OUT_H);
  }

  delayedFrame(latencyMs) {
    const back = clamp(Math.round(latencyMs / 16.7), 0, RING_N - 2);
    return this.ring[(this.head - back + RING_N) % RING_N];
  }

  spawnCorruption(m) {
    const c = this.cfg;
    if (this.hail < 0.04) return;
    // Parity only shields hail damage while there is room to send it (see the
    // loss model): a saturated link drops the shards along with the payload.
    const shielded = (1 - Math.min(0.85, m.fecEff * 1.6)) * (c.transport === 'tcp' ? 0.12 : 1);
    const count = Math.round(this.hail * 9 * shielded * (0.5 + this.rng()));
    const garbage = c.transport === 'udp' && !c.checksum;

    for (let i = 0; i < count; i++) {
      const w = 24 + this.rng() * 70 | 0;
      const h = 16 + this.rng() * 48 | 0;
      const x = this.rng() * (OUT_W - w) | 0;
      const y = this.rng() * (OUT_H - h) | 0;
      let img;
      try { img = this.workCtx.getImageData(x, y, w, h); } catch { return; }

      if (garbage) {
        const d = img.data;
        const shift = ((this.rng() * 40 | 0) + 3) * 4;
        for (let p = 0; p < d.length; p += 4) {
          if (this.rng() < 0.35) continue; // partial corruption reads through
          const q = (p + shift) % d.length;
          d[p] = (d[q] + 60) & 0xff;
          d[p + 1] = d[q + 1];
          d[p + 2] = (d[q + 2] + 110) & 0xff;
        }
      }
      this.blocks.push({
        img, x, y,
        dx: (this.rng() - 0.5) * 1.6,
        dy: (this.rng() - 0.5) * 0.9,
        age: 0,
      });
    }
    if (this.blocks.length > 90) this.blocks.splice(0, this.blocks.length - 90);
  }

  stampCorruption() {
    for (const b of this.blocks) {
      b.age++;
      const x = Math.round(b.x + b.dx * b.age);
      const y = Math.round(b.y + b.dy * b.age);
      this.workCtx.putImageData(b.img, x, y);
    }
  }

  decodeFrame(m) {
    const c = this.cfg;
    const [rw, rh] = RES_LADDER[c.resolution];
    const srcFrame = this.delayedFrame(m.latency);

    // spatial resolution: downscale then upscale back to the display buffer
    this.scaleCtx.clearRect(0, 0, OUT_W, OUT_H);
    this.scaleCtx.filter = m.denoise > 0 ? `blur(${(m.denoise * 2.4).toFixed(2)}px)` : 'none';
    this.scaleCtx.drawImage(srcFrame, 0, 0, OUT_W, OUT_H, 0, 0, rw, rh);
    this.scaleCtx.filter = 'none';

    // CBR starvation -> macroblocking
    let bw = rw, bh = rh;
    if (m.quant > 0.03) {
      bw = Math.max(16, Math.round(rw * (1 - m.quant * 0.75)));
      bh = Math.max(9, Math.round(rh * (1 - m.quant * 0.75)));
      this.scaleCtx.imageSmoothingEnabled = false;
      this.scaleCtx.drawImage(this.scale, 0, 0, rw, rh, 0, 0, bw, bh);
      this.scaleCtx.imageSmoothingEnabled = true;
    }

    this.workCtx.imageSmoothingEnabled = m.quant <= 0.03;
    this.workCtx.drawImage(this.scale, 0, 0, bw, bh, 0, 0, OUT_W, OUT_H);
    this.workCtx.imageSmoothingEnabled = true;
  }

  /* --------------------------------------------------------------- loop */

  frame(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    // A negative delta (clock skew, out-of-order timestamp) would rewind the storm
    // and poison the score accumulators, so floor it at zero.
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (this.ended) { this.paintChrome(this.lastMetrics, dt, true); return; }

    this.t += dt;
    // Re-seed on every cycle boundary so the discrete events (outages, TCP
    // stalls, drops, hail placement) replay the same way each time round.
    const cyc = Math.floor(this.t / CYCLE_S);
    if (cyc !== this.cycleIdx) {
      this.cycleIdx = cyc;
      this.rng = mulberry32(STORM_SEED);
      // Rewind the pipeline too. The weather and the footage now repeat exactly,
      // so the only remaining source of cycle-to-cycle drift is carried-over
      // encoder state: the GOP phase, the pacing accumulator, a half-served
      // stall and whatever corruption was still on screen.
      this.frameNo = 0;
      this.frameAcc = 0;
      this.stall = 0;
      this.blocks.length = 0;
    }
    this.updateWeather(dt);
    const m = this.computeMetrics();
    this.lastMetrics = m;

    if (this.batteryEnabled) this.battery = clamp(this.battery - m.drain * dt, 0, 100);
    const dead = this.batteryEnabled && this.battery <= 0.05;

    this.renderSource();
    this.pushRing();

    if (this.showRef) this.refCtx.drawImage(this.src, 0, 0, OUT_W, OUT_H);

    // --- delivery decision -------------------------------------------------
    this.frameAcc += dt * 1000;
    const interval = 1000 / this.cfg.fps;
    let delivered = false;
    this.stall = Math.max(0, this.stall - dt * 1000);
    if (this.frameAcc >= interval) {
      this.frameAcc = Math.min(this.frameAcc - interval, interval);
      const stutter = clamp(m.unabsorbed / 520, 0, 0.92);
      const dropP = clamp(m.loss + stutter, 0, 0.97);
      // TCP never shows a hole — it stops the world until the retransmit lands.
      if (this.cfg.transport === 'tcp' && this.rng() < Math.pow(m.lossPreTcp, 1.6) * 1.3) {
        this.stall = Math.max(this.stall, 50 + 1.5 * m.latency * (0.4 + this.rng()));
      }
      if (this.outage <= 0 && !dead && this.stall <= 0 && this.rng() > dropP) delivered = true;
    }

    if (delivered) {
      this.lastDelivery = this.t;
      this.frameNo++;
      const isKey = this.frameNo % m.gopEff === 0;
      if (isKey || !this.cfg.pframes) this.blocks.length = 0;
      this.decodeFrame(m);
      this.spawnCorruption(m);
    }

    // corruption persists (and smears) whether or not a new frame arrived
    if (this.blocks.length) this.stampCorruption();

    // --- present -----------------------------------------------------------
    const sctx = this.streamCtx;
    if (dead) {
      sctx.fillStyle = '#000';
      sctx.fillRect(0, 0, OUT_W, OUT_H);
    } else {
      sctx.drawImage(this.work, 0, 0);
      if (this.outage > 0) {
        sctx.fillStyle = 'rgba(0,0,0,.55)';
        sctx.fillRect(0, 0, OUT_W, OUT_H);
      }
      if (m.loss > 0.12) {
        sctx.save();
        sctx.globalAlpha = clamp(m.loss * 0.5, 0, 0.5);
        sctx.fillStyle = '#0a1018';
        for (let i = 0; i < 14; i++) {
          const y = this.rng() * OUT_H | 0;
          sctx.fillRect(0, y, OUT_W, 1 + this.rng() * 3);
        }
        sctx.restore();
      }
    }

    this.measureFidelity(dt, dead, m);
    this.paintChrome(m, dt, false);
  }

  /**
   * Fidelity = how loyal the received picture is to what the sensor actually saw,
   * measured from real pixels on four axes:
   *   accuracy       — mean absolute error, normalised by the scene's own energy
   *   detail         — block-pooled gradient error (blur, low resolution, corruption)
   *   motion         — block-pooled frame-delta error (freezes, drops, low fps, smear)
   *   responsiveness — how stale the picture is by the time it reaches the mainland
   * The reference is the era-matched frame from the same 640x360 transport path, so
   * a buffer is NOT punished for being a buffer (S2's lesson) — only for going stale.
   */
  measureFidelity(dt, dead, m) {
    this.cmpTick++;
    if (this.cmpTick % 5 === 0) {
      this.cmpACtx.drawImage(this.el.stream, 0, 0, CMP_W, CMP_H);
      // The reference is delayed by the latency the operator DELIBERATELY chose —
      // not by the extra latency congestion or retransmits inflicted on them.
      // So a big buffer is free (S2), but lag you did not budget for is an error.
      this.cmpBCtx.drawImage(this.delayedFrame(m.refDelay), 0, 0, CMP_W, CMP_H);
      try {
        const A = this.cmpACtx.getImageData(0, 0, CMP_W, CMP_H).data;
        const B = this.cmpBCtx.getImageData(0, 0, CMP_W, CMP_H).data;
        const N = CMP_W * CMP_H;
        const ga = this.ga, gb = this.gb;

        let sumDiff = 0, sumRef = 0;
        for (let i = 0, p = 0; i < N; i++, p += 4) {
          const va = (A[p] * 77 + A[p + 1] * 151 + A[p + 2] * 28) >> 8;
          const vb = (B[p] * 77 + B[p + 1] * 151 + B[p + 2] * 28) >> 8;
          ga[i] = va; gb[i] = vb;
          sumDiff += va > vb ? va - vb : vb - va;
          sumRef += vb;
        }
        const pixDiff = sumDiff / N;
        const refE = sumRef / N;

        // Block-pooled structural comparison: coarse enough to tolerate the
        // motion phase shift a buffered link always has, local enough that
        // corruption in one region cannot "pay for" blur in another.
        const bw = Math.ceil(CMP_W / BLK), bh = Math.ceil(CMP_H / BLK);
        const gA = this.blkGA, gB = this.blkGB, mA = this.blkMA, mB = this.blkMB;
        gA.fill(0); gB.fill(0); mA.fill(0); mB.fill(0);
        const hadPrev = this.prevReady;
        const pa = this.pa, pb = this.pb;
        for (let y = 0; y < CMP_H - 1; y++) {
          const r = y * CMP_W, b = ((y / BLK) | 0) * bw;
          for (let x = 0; x < CMP_W - 1; x++) {
            const i = r + x, k = b + ((x / BLK) | 0);
            gA[k] += Math.abs(ga[i + 1] - ga[i]) + Math.abs(ga[i + CMP_W] - ga[i]);
            gB[k] += Math.abs(gb[i + 1] - gb[i]) + Math.abs(gb[i + CMP_W] - gb[i]);
            if (hadPrev) {
              mA[k] += Math.abs(ga[i] - pa[i]);
              mB[k] += Math.abs(gb[i] - pb[i]);
            }
          }
        }
        let gradErr = 0, gradRef = 0, motErr = 0, motRef = 0;
        const nb = bw * bh, floor = BLK * BLK * 0.6;
        for (let k = 0; k < nb; k++) {
          gradErr += Math.abs(gA[k] - gB[k]); gradRef += gB[k] + floor;
          motErr += Math.abs(mA[k] - mB[k]); motRef += mB[k] + floor;
        }
        this.pa.set(ga); this.pb.set(gb); this.prevReady = true;

        this.refEnergyEMA = this.refEnergyEMA ? lerp(this.refEnergyEMA, refE, 0.08) : refE;
        const denom = clamp(this.refEnergyEMA * 1.15, 12, 70);
        const pixTerm = clamp(1 - pixDiff / denom, 0, 1);
        const detTerm = clamp(1 - gradErr / Math.max(gradRef, 1), 0, 1);
        const motTerm = hadPrev ? clamp(1 - motErr / Math.max(motRef, 1), 0, 1) : 1;

        const a = this.terms ? 0.35 : 1;
        this.terms = {
          pixTerm: this.terms ? lerp(this.terms.pixTerm, pixTerm, a) : pixTerm,
          detTerm: this.terms ? lerp(this.terms.detTerm, detTerm, a) : detTerm,
          motTerm: this.terms ? lerp(this.terms.motTerm, motTerm, a) : motTerm,
          rspTerm: 1,
        };
      } catch { /* tainted canvas — keep the previous reading */ }
    }
    if (this.terms) {
      const T = this.terms;
      // Buffering is free up to a point; past ~350 ms of total staleness
      // (transport latency + time since the last frame actually landed) the
      // mainland is looking at history instead of an incident.
      const stale = m.latency + Math.max(0, this.t - this.lastDelivery) * 1000;
      T.rspTerm = clamp(1 - Math.max(0, stale - 350) / 1200, 0, 1);
      this.fidInstant = clamp(100 * (
        0.36 * T.pixTerm + 0.24 * T.detTerm + 0.22 * T.motTerm + 0.18 * T.rspTerm
      ), 0, 100);
    }
    if (dead) this.fidInstant = 0;
    if (!this.fidReady) {
      if (!this.terms) return;   // nothing measured yet — do not score the warm-up
      this.fidReady = true;
      this.fidEMA = this.fidInstant;
    }
    this.fidEMA = lerp(this.fidEMA, this.fidInstant, clamp(dt * 2.2, 0, 1));
    this.fidSum += this.fidEMA * dt;
    this.fidSamples += dt;

    this.window.push({ t: this.t, v: this.fidEMA, dt });
    while (this.window.length && this.t - this.window[0].t > CYCLE_S) this.window.shift();
    this.updateStable();

    this.sparkAcc += dt;
    if (this.sparkAcc >= this.sparkEvery) {
      this.sparkAcc = 0;
      this.spark.push(this.fidEMA);
      // Keep the whole round on screen: halve the resolution instead of scrolling.
      if (this.spark.length > 170) {
        this.spark = this.spark.filter((_, i) => i % 2 === 0);
        this.sparkEvery *= 2;
      }
    }
  }

  /**
   * Invalidate the current measurement. Called whenever the dashboard changes:
   * the trailing window now straddles two different configurations, so it no
   * longer describes either of them and must be re-earned over a fresh cycle.
   */
  noteChange() {
    if (this.ended) return;
    this.changes++;
    this.lastChange = this.t;
    this.stable = null;
  }

  /** How far through the wait for the next valid reading, 0..1. */
  measureProgress() {
    return clamp((this.t - this.lastChange) / CYCLE_S, 0, 1);
  }

  /**
   * A reading is valid only when the trailing window is a full cycle long AND
   * every sample in it was produced by the current settings. Because the storm
   * is exactly CYCLE_S-periodic, such a window always covers one whole storm —
   * so this number is steady, and comparable between configurations.
   */
  updateStable() {
    const span = this.window.length
      ? this.window[this.window.length - 1].t - this.window[0].t : 0;
    if (span < CYCLE_S * 0.97 || this.t - this.lastChange < CYCLE_S) return;

    let s = 0, w = 0;
    for (const r of this.window) { s += r.v * r.dt; w += r.dt; }
    if (w <= 0) return;
    const v = s / w;
    this.stable = v;

    // Only a tuned configuration can win — the untouched defaults do not count.
    if (this.changes > 0 && (this.best === null || v > this.best)) {
      this.best = v;
      this.bestCfg = { ...this.cfg };
    }
  }

  drawSpark() {
    const ctx = this.sparkCtx;
    if (!ctx) return;
    const W = this.el.spark.width, H = this.el.spark.height;
    ctx.clearRect(0, 0, W, H);
    const n = this.spark.length;
    const y = v => H - 4 - (clamp(v, 0, 100) / 100) * (H - 8);

    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 2;
    for (const g of [25, 50, 75]) {
      ctx.beginPath(); ctx.moveTo(0, y(g)); ctx.lineTo(W, y(g)); ctx.stroke();
    }
    if (n < 2) return;

    const x = i => (i / (n - 1)) * W;

    // live fidelity, drawn faintly — it is the storm, not the score
    ctx.beginPath();
    ctx.moveTo(x(0), y(this.spark[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(this.spark[i]));
    ctx.lineTo(x(n - 1), H); ctx.lineTo(x(0), H); ctx.closePath();
    ctx.fillStyle = 'rgba(63,224,208,.10)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x(0), y(this.spark[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(this.spark[i]));
    ctx.strokeStyle = 'rgba(63,224,208,.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // the settled score for the current settings — flat, because it is stable
    if (this.stable !== null) {
      ctx.beginPath(); ctx.moveTo(0, y(this.stable)); ctx.lineTo(W, y(this.stable));
      ctx.strokeStyle = '#3fe0d0';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // the best settled score so far — the bar to beat
    if (this.best !== null) {
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0, y(this.best)); ctx.lineTo(W, y(this.best));
      ctx.strokeStyle = 'rgba(255,180,84,.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  paintChrome(m, dt, frozen) {
    if (!m) return;
    const el = this.el;
    const bwShown = Math.min(100, m.bwPct);
    if (!frozen) {
      this.bwSum += bwShown * dt; this.bwSamples += dt;
      this.peakBw = Math.max(this.peakBw, m.bwPct);
      if (m.saturated) this.breachTime += dt;
    }

    const set = (k, val, pct, state, sub) => {
      el[k + 'v'].textContent = val;
      el[k + 'b'].style.width = clamp(pct, 0, 100) + '%';
      el[k].className = 'metric' + (state ? ' ' + state : '');
      el[k + 's'].textContent = sub || '';
    };

    set('bw', bwShown.toFixed(0), bwShown,
      m.saturated ? 'crit' : bwShown > 88 ? 'warn' : '',
      m.saturated ? 'SATURATED' : `${m.bitrate.toFixed(1)}/${m.capacity.toFixed(1)} Mbps`);

    set('fid', this.fidEMA.toFixed(1), this.fidEMA,
      this.fidEMA < 45 ? 'crit' : this.fidEMA < 70 ? 'warn' : '',
      'RIGHT NOW');

    // Round score. Deliberately NOT live: it only updates once a full storm
    // cycle has run under the current settings, so it is a steady number the
    // contestant can compare against their best instead of a twitching readout.
    const prog = this.measureProgress();
    const settled = this.stable !== null;
    el.score.className = 'metric score'
      + (this.ended ? ' locked' : settled ? ' settled' : ' measuring');
    el.scorev.textContent = settled ? this.stable.toFixed(1) : '—';
    el.scoreb.style.width = (settled ? 100 : prog * 100).toFixed(1) + '%';

    if (this.ended) {
      el.scorestate.textContent = 'LOCKED';
    } else if (settled) {
      el.scorestate.textContent = this.changes === 0 ? 'BASELINE' : 'SETTLED';
    } else {
      const left = Math.ceil(clamp(CYCLE_S - (this.t - this.lastChange), 0, CYCLE_S));
      el.scorestate.textContent =
        `${this.changes === 0 ? 'BASELINE' : 'MEASURING'} · ${left}s`;
    }

    if (this.best === null) {
      el.scorebest.innerHTML = this.changes === 0
        ? '<b class="flat">BASELINE — CHANGE A SETTING TO SCORE</b>'
        : '<b class="flat">FIRST READING IN PROGRESS…</b>';
    } else {
      const d = settled ? this.stable - this.best : 0;
      const cls = !settled ? 'flat' : d >= -0.05 ? 'up' : 'down';
      const arrow = !settled ? '' : d >= -0.05 ? '▲ ' : `▼ ${d.toFixed(1)} `;
      el.scorebest.innerHTML =
        `BEST <b class="${cls}">${arrow}${this.best.toFixed(1)}%</b>`;
    }
    this.drawSpark();

    set('lat', m.latency.toFixed(0), m.latency / 12,
      m.latency > 900 ? 'crit' : m.latency > 500 ? 'warn' : '', `BUF ${this.cfg.jitterBuf} ms`);

    const lossPct = m.loss * 100;
    set('loss', lossPct.toFixed(1), lossPct * 2,
      lossPct > 25 ? 'crit' : lossPct > 8 ? 'warn' : '',
      m.unabsorbed > 5 ? `JITTER +${m.unabsorbed | 0}ms` : 'BUFFER OK');

    const mins = m.drain > 0 ? this.battery / m.drain / 60 : 0;
    set('bat', this.battery.toFixed(0), this.battery,
      this.battery < 15 ? 'crit' : this.battery < 35 ? 'warn' : '',
      this.batteryEnabled ? `≈${mins.toFixed(0)} MIN LEFT` : 'DRAIN OFF');

    el.wx.innerHTML = `WIND <b>${(this.wind * 100) | 0}%</b> · HAIL <b>${(this.hail * 100) | 0}%</b>`;
    if (this.terms) {
      const { pixTerm, detTerm, motTerm, rspTerm } = this.terms;
      el.fidbreak.innerHTML = `ACC <b>${(pixTerm * 100) | 0}</b> · DET <b>${(detTerm * 100) | 0}</b> · MOT <b>${(motTerm * 100) | 0}</b> · RSP <b>${(rspTerm * 100) | 0}</b>`;
    }

    let alert = '';
    if (this.batteryEnabled && this.battery <= 0.05) alert = 'BATTERY DEPLETED · TOWER DARK';
    else if (this.outage > 0) alert = 'SIGNAL LOST · RECONNECTING';
    else if (m.saturated) alert = 'LINK SATURATED · SHEDDING PACKETS';
    else if (this.batteryEnabled && this.battery < 15) alert = 'BROWNOUT · TX POWER LIMITED';
    el.alert.textContent = alert;
    el.alert.classList.toggle('show', !!alert && !frozen);
  }

  /* ------------------------------------------------------------ commands */

  start() {
    this.frame = this.frame.bind(this);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.el.dash.classList.add('locked');
    this.el.dash.querySelectorAll('input,select,button').forEach(x => { x.disabled = true; });
    this.el.dashState.textContent = 'LOCKED';
    this.el.alert.classList.remove('show');

    // The result is the best SETTLED reading — a full storm cycle measured under
    // one unchanged configuration, after the contestant actually tuned something.
    // Anything else is a mis-press or an untouched dashboard, and is not a score.
    const scored = this.best !== null;
    const final = scored ? this.best : 0;
    const grade = final >= 88 ? 'KEEPER OF THE LIGHT'
      : final >= 78 ? 'HARBOUR MASTER'
      : final >= 66 ? 'WATCH OFFICER'
      : final >= 50 ? 'DECKHAND'
      : 'THE SEA WON';
    const avgBw = this.bwSamples > 0 ? this.bwSum / this.bwSamples : 0;

    const entry = scored ? {
      id: ++this.runCounter,
      name: `RUN ${this.runCounter}`,
      score: final,
      grade,
      avgBw,
      peak: this.peakBw,
      breach: this.breachTime,
      length: this.fidSamples,
    } : null;
    if (entry) { this.rounds.push(entry); this.currentEntry = entry; }
    else this.currentEntry = null;

    if (this.networked && entry && this.onSubmit) {
      this.onSubmit({ score: final, grade, changes: this.changes, peak: this.peakBw });
    }

    const card = document.createElement('div');
    card.className = 'final';
    card.innerHTML = `
      <div class="card">
        <div class="lbl">BEST SETTLED FIDELITY — LOYALTY TO THE SENSOR</div>
        <div class="big">${scored ? final.toFixed(1) : '—'}<span style="font-size:.35em">%</span></div>
        <div class="grade">${scored ? grade : 'NO VALID READING'}</div>
        <div class="sub">
          <span>WATCH LENGTH <b>${this.fidSamples.toFixed(0)}s</b></span>
          <span>SETTINGS TRIED <b>${this.changes}</b></span>
          <span>AVG BANDWIDTH <b>${avgBw.toFixed(0)}%</b></span>
          <span>PEAK DEMAND <b>${this.peakBw.toFixed(0)}%</b></span>
          <span>TIME OVER CAP <b class="${this.breachTime > 1 ? 'rd' : 'gr'}">${this.breachTime.toFixed(1)}s</b></span>
          <span>BATTERY LEFT <b>${this.battery.toFixed(0)}%</b></span>
        </div>
        ${entry && !this.networked ? `
        <div class="namer">
          <label for="run-name">CONTESTANT</label>
          <input id="run-name" type="text" maxlength="22" placeholder="${entry.name}" autocomplete="off"/>
        </div>` : ''}
        ${!scored ? `
        <div class="board-empty" style="margin-top:20px">
          No settled reading — a score needs one changed setting held for a full
          ${CYCLE_S}s storm cycle.${this.networked ? '' : ' Press <b>R</b> to run it properly.'}
        </div>` : ''}
        <div class="${this.networked ? 'board-host' : 'board'}" id="board"></div>
        ${this.networked ? '' : `
        <div class="lbl" style="margin-top:22px">
          <b style="color:#3fe0d0">R</b> NEXT CONTESTANT ·
          <b style="color:#3fe0d0">C</b> CLEAR LEADERBOARD
        </div>`}
      </div>`;
    this.root.appendChild(card);
    this.finalCard = card;

    const input = card.querySelector('#run-name');
    if (input) {
      input.addEventListener('input', () => {
        entry.name = input.value.trim() || `RUN ${entry.id}`;
        this.renderBoard();
      });
      // Let the presenter type a name without R/B/V/F hijacking the keystrokes.
      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') input.blur();
        e.stopPropagation();
      });
      setTimeout(() => input.focus(), 30);
    }
    this.renderBoard();
  }

  /** Room results arriving from the presenter's database. */
  setSharedRows(rows, revealed) {
    this.sharedRows = rows || [];
    this.sharedRevealed = !!revealed;
    this.renderBoard();
  }

  renderBoard() {
    const host = this.finalCard?.querySelector('#board');
    if (!host) return;

    if (this.networked) {
      host.innerHTML = boardHTML(this.sharedRows, {
        revealed: this.sharedRevealed,
        title: 'FINAL LEADERBOARD',
        tag: r => r.grade || '',
        empty: 'Waiting for the room to finish.',
      });
      return;
    }

    if (!this.rounds.length) {
      host.innerHTML = `<div class="board-empty">Leaderboard cleared.</div>`;
      return;
    }
    const ranked = [...this.rounds].sort((a, b) => b.score - a.score);
    host.innerHTML = `
      <div class="board-title">LEADERBOARD · ${this.rounds.length} RUN${this.rounds.length > 1 ? 'S' : ''}</div>
      <ol class="board-list">
        ${ranked.map((r, i) => `
          <li class="${r === this.currentEntry ? 'mine' : ''}${i === 0 ? ' crown' : ''}">
            <span class="rank">${i + 1}</span>
            <span class="who">${escapeHTML(r.name)}</span>
            <span class="pts">${r.score.toFixed(1)}%</span>
            <span class="tag2">${r.grade}</span>
          </li>`).join('')}
      </ol>
      ${this.rounds.length < 2
        ? `<div class="board-empty" style="margin-top:10px">Press <b>R</b> to hand the console to the next contestant.</div>`
        : ''}`;
  }

  clearBoard() {
    this.rounds = [];
    this.runCounter = 0;
    this.currentEntry = null;
    this.renderBoard();
  }

  restart() {
    this.finalCard?.remove();
    this.finalCard = null;
    this.ended = false;
    this.el.dash.classList.remove('locked');
    this.el.dash.querySelectorAll('input,select,button').forEach(x => { x.disabled = false; });
    this.el.dashState.textContent = 'LIVE';
    this.resetDashboard();
    this.resetState();
  }

  /**
   * Hand the console over on the same footing: every contestant starts from the
   * factory defaults, not from the previous contestant's tuned setup.
   */
  resetDashboard() {
    for (const g of GROUPS) for (const it of g.items) {
      this.cfg[it.id] = it.def;
      const input = this.root.querySelector(`#c-${it.id}`);
      if (!input) continue;
      if (it.kind === 'toggle') input.checked = it.def;
      else {
        input.value = it.def;
        if (it.kind === 'range') {
          this.root.querySelector(`#v-${it.id}`).textContent = it.fmt(it.def);
        }
      }
    }
  }

  toggleReference() {
    this.showRef = !this.showRef;
    this.el.vpRef.classList.toggle('hidden', !this.showRef);
    this.el.viewports.classList.toggle('dual', this.showRef);
  }

  toggleBattery() {
    this.batteryEnabled = !this.batteryEnabled;
    if (!this.batteryEnabled) this.battery = 100;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.el.dash.removeEventListener('input', this.onInput);
    this.el.dash.removeEventListener('change', this.onInput);
    try { this.el.video.pause(); this.el.video.removeAttribute('src'); this.el.video.load(); } catch { /* noop */ }
    this.root.innerHTML = '';
  }
}
