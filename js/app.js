import { STEPS, SCENARIOS, SCENARIO_COUNT } from './content.js';
import { drawScene } from './lighthouse.js';
import { FixThatStream } from './game.js';
import { initSession, session, net, toggleSessionPanel, setPlayerCount } from './session.js';
import { boardHTML, quizGrade } from './board.js';
import { NET_CONFIGURED } from './config.js';

/* ------------------------------------------------------------------ state */

const stage = document.getElementById('stage');
const hudSection = document.getElementById('hud-section');
const hudScore = document.getElementById('hud-score');
const hudCount = document.getElementById('hud-count');
const track = document.getElementById('progress-track');
const helpEl = document.getElementById('help');

let index = 0;
let game = null;
/** @type {Record<string,{chosen:string,correct:boolean}>} */
const answers = Object.create(null);

/** Mirrors the host's published state; all zeros/false in solo mode. */
const shared = { step: 0, gameLocked: false, revealQuiz: false, revealGame: false };
let quizRows = [];
let gameRows = [];
let quizSubmitted = false;

const score = () => Object.values(answers).filter(a => a.correct).length;
const isHost = () => session.mode === 'host';
const isGuest = () => session.mode === 'guest';

/* -------------------------------------------------- ambient scene canvas */

const bg = document.getElementById('scene-bg');
const bgCtx = bg.getContext('2d');
const bgBuf = document.createElement('canvas');
const bgBufCtx = bgBuf.getContext('2d');
bgBuf.width = 960; bgBuf.height = 540;
let bgRaf = 0;
let bgRunning = false;

function sizeBg() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  bg.width = Math.round(window.innerWidth * dpr);
  bg.height = Math.round(window.innerHeight * dpr);
}
sizeBg();
window.addEventListener('resize', sizeBg);

function bgLoop(ms) {
  bgRaf = requestAnimationFrame(bgLoop);
  drawScene(bgBufCtx, bgBuf.width, bgBuf.height, ms / 1000, { wind: 0.65 });
  bgCtx.drawImage(bgBuf, 0, 0, bg.width, bg.height);
}
function startBg() { if (!bgRunning) { bgRunning = true; bgRaf = requestAnimationFrame(bgLoop); } }
function stopBg() { if (bgRunning) { bgRunning = false; cancelAnimationFrame(bgRaf); } }

/* --------------------------------------------------------------- chrome */

function buildProgress() {
  track.innerHTML = STEPS.map((s, i) =>
    `<i data-i="${i}" title="${s.section}"></i>`).join('');
}

function paintChrome() {
  const step = STEPS[index];
  hudSection.textContent = step.section;
  hudCount.textContent = `${String(index + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;

  const showScore = step.type === 'scenario' || step.type === 'debrief';
  hudScore.classList.toggle('hidden', !showScore);
  hudScore.querySelector('b').textContent = score();

  [...track.children].forEach((el, i) => {
    el.className = i < index ? 'done' : i === index ? 'now' : '';
  });

  document.body.classList.toggle('cinematic', !!step.cinematic);
  document.body.classList.toggle('game-mode', step.type === 'game');
}

function bumpScore() {
  hudScore.classList.remove('bump');
  void hudScore.offsetWidth;
  hudScore.classList.add('bump');
}

/* -------------------------------------------------------------- renderers */

function renderSlide(step) {
  const body = `
    <div class="${step.figure ? 'grid' : 'grid one'}">
      <div>
        <div class="kicker">${step.kicker}</div>
        <h2>${step.title}</h2>
        <ul class="bullets">${step.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
        ${step.takeaway ? `<div class="takeaway"><b>TAKEAWAY</b>${step.takeaway}</div>` : ''}
      </div>
      ${step.figure ? `<div class="panel"><div class="panel-title"><span>${step.kicker}</span><span>FIG.</span></div>${step.figure}</div>` : ''}
    </div>`;
  stage.innerHTML = `<div class="slide">${body}</div>`;
}

function renderScenario(step) {
  const s = step.scenario;
  const prior = answers[s.code];
  stage.innerHTML = `
    <div class="slide scenario">
      <div class="sid">INCIDENT ${s.code} · TOWER TELEMETRY</div>
      <h2>${s.title}</h2>
      <div class="telemetry">${s.telemetry.map(t => {
        const [k, v] = t.split(': ');
        return `<span>${k}${v ? `<b>${v}</b>` : ''}</span>`;
      }).join('')}</div>
      <p class="story">${s.story}</p>
      <div class="options">
        <button class="opt" data-k="a"><span class="key">A</span>${s.a}</button>
        <button class="opt" data-k="b"><span class="key">B</span>${s.b}</button>
      </div>
      <div id="verdict-slot"></div>
      <div class="nudge hidden" id="nudge">→ PRESS RIGHT ARROW FOR THE NEXT INCIDENT</div>
    </div>`;

  const buttons = [...stage.querySelectorAll('.opt')];
  buttons.forEach(b => b.addEventListener('click', () => answer(s, b.dataset.k)));
  if (prior) reveal(s, prior.chosen, false);
}

function reveal(s, chosen, animate) {
  const buttons = [...stage.querySelectorAll('.opt')];
  if (!buttons.length) return;
  const ok = chosen === s.correct;
  buttons.forEach(b => {
    b.disabled = true;
    if (b.dataset.k === s.correct) b.classList.add('correct');
    else if (b.dataset.k === chosen) b.classList.add('wrong');
    else b.classList.add('dim');
  });

  const slot = stage.querySelector('#verdict-slot');
  slot.innerHTML = `
    <div class="verdict ${ok ? 'hit' : 'miss'}">
      <div class="tag">${ok ? '✔ RESULT — CORRECT CALL' : '✕ RESULT — THE STORM WINS THIS ONE'}</div>
      <p style="margin:0">${ok ? s.resultOk : s.resultNo}</p>
      <div class="lesson"><b>LESSON</b>${s.lesson}</div>
    </div>`;
  stage.querySelector('#nudge').classList.remove('hidden');
  if (animate && ok) bumpScore();
}

function answer(s, chosen) {
  if (answers[s.code]) return;
  answers[s.code] = { chosen, correct: chosen === s.correct };
  paintChrome();
  reveal(s, chosen, true);
  publishQuiz();
}

/**
 * Push the running incident score to the room. Sent on every answer rather than
 * once at the end, so someone who drops out mid-section still appears — and so
 * the presenter can watch the board fill up live.
 */
function publishQuiz() {
  if (!isGuest() || !net.ok) return;
  quizSubmitted = true;
  net.submitQuiz(score(), SCENARIO_COUNT);
}

function renderBoardStep(step) {
  const quiz = step.board === 'quiz';
  const rows = quiz ? quizRows : gameRows;
  const revealed = quiz ? shared.revealQuiz : shared.revealGame;

  // Solo mode has no room to gather scores from, so the board becomes a plain
  // summary of this machine's own result rather than an empty promise.
  if (session.mode === 'solo') {
    const n = score();
    stage.innerHTML = `
      <div class="slide">
        <div class="kicker amber">INCIDENT BOARD</div>
        <h2>${n} / ${SCENARIO_COUNT} · ${quizGrade(n)}</h2>
        <p class="lead">${NET_CONFIGURED
          ? `Running solo, so there is nobody to rank against. Press <b>GO LIVE</b> in the
             top bar to open a room and let the audience play along.`
          : `Running on one machine, so this is your own tally. Show of hands: who beat it?`}</p>
      </div>`;
    return;
  }

  stage.innerHTML = `
    <div class="slide board-slide">
      <div class="kicker amber">INCIDENT BOARD</div>
      <h2>Eight incidents. Who read the storm best?</h2>
      ${boardHTML(rows, {
        revealed,
        title: 'INCIDENT LEADERBOARD',
        fmt: v => `${v} / ${SCENARIO_COUNT}`,
        tag: r => quizGrade(r.score),
        empty: 'Waiting for the room to answer.',
        waiting: session.players,
      })}
    </div>`;
}

function renderGame() {
  stage.innerHTML = '';
  game = new FixThatStream(stage, {
    net: session.mode === 'solo' ? null : net,
    onSubmit: entry => { if (isGuest() && net.ok) net.submitGame(entry); },
  });
  game.start();
  if (shared.gameLocked) game.end();
}

function renderDebrief(step) {
  stage.innerHTML = step.html;
  const tally = stage.querySelector('#tally');
  if (tally) {
    tally.innerHTML = SCENARIOS.map(s => {
      const a = answers[s.code];
      return `<i class="${a ? (a.correct ? 'ok' : 'no') : ''}" title="${s.code} ${s.title}"></i>`;
    }).join('');
  }
  const line = stage.querySelector('#tally-line');
  if (line) {
    const n = score();
    const verdict = n >= 7 ? 'HARBOUR MASTER' : n >= 5 ? 'SENIOR WATCH OFFICER' : n >= 3 ? 'JUNIOR ENGINEER' : 'TRAINEE — SEE ME AFTER THE STORM';
    line.textContent = `SCORE ${n}/${SCENARIO_COUNT} · RANK: ${verdict}`;
  }
}

function teardownGame() {
  if (game) { game.destroy(); game = null; }
}

/* ------------------------------------------------------------------ nav */

function show(i, force) {
  const next = Math.max(0, Math.min(STEPS.length - 1, i));
  if (next === index && stage.childElementCount && !force) return;
  teardownGame();
  index = next;
  const step = STEPS[index];

  if (step.type === 'game') stopBg(); else startBg();

  switch (step.type) {
    case 'slide': renderSlide(step); break;
    case 'scenario': renderScenario(step); break;
    case 'debrief': renderDebrief(step); break;
    case 'board': renderBoardStep(step); break;
    case 'game': renderGame(); break;
    default: stage.innerHTML = step.html;
  }
  paintChrome();
  stage.focus({ preventScroll: true });
  history.replaceState(null, '', `#${index + 1}`);
}

/** Navigation the presenter drives. Guests reach `show()` only via the room. */
function goto(i) {
  if (isGuest()) return;          // the host owns the pacing
  show(i);
  if (isHost()) net.setState({ step: index });
}

const next = () => goto(index + 1);
const prev = () => goto(index - 1);

/* -------------------------------------------------------------- keyboard */

function isFormTarget(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}

/** A free-text field must own every keystroke, or typing a name triggers R/V/B/F. */
function isTextEntry(e) {
  const t = e.target;
  return t && (t.tagName === 'TEXTAREA'
    || (t.tagName === 'INPUT' && ['text', 'search', 'number', 'email'].includes(t.type)));
}

window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const step = STEPS[index];
  const key = e.key;

  if (isTextEntry(e)) {
    if (key === 'Escape') e.target.blur();
    return;
  }

  // help overlay swallows everything
  if (!helpEl.classList.contains('hidden')) {
    if (key === 'Escape' || key === '?' || key === 'Enter' || key === ' ') {
      e.preventDefault();
      helpEl.classList.add('hidden');
    }
    return;
  }
  if (key === '?') { e.preventDefault(); helpEl.classList.remove('hidden'); return; }

  // session panel also swallows everything while it is up
  const panel = document.getElementById('session-panel');
  if (panel && !panel.classList.contains('hidden')) {
    if (key === 'Escape' || key === 's' || key === 'S') {
      e.preventDefault();
      toggleSessionPanel(false);
    }
    return;
  }
  if ((key === 's' || key === 'S') && session.mode !== 'solo') {
    e.preventDefault(); toggleSessionPanel(true); return;
  }

  // Reveal the names on whichever board is on screen. Host-only: the whole
  // point is that nobody sees them until the room does, together.
  if ((key === 'l' || key === 'L') && isHost()) {
    e.preventDefault();
    if (step.type === 'board') net.setState({ revealQuiz: true });
    else if (step.type === 'game') net.setState({ revealGame: true });
    return;
  }

  if (key === 'f' || key === 'F') {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
    return;
  }

  // the game owns Enter/Escape/R/V/B/C while it is on screen
  if (game && step.type === 'game') {
    // In a room the presenter ends the round for everybody at once, so this is
    // published rather than applied locally; the listener closes it on every
    // machine including this one.
    if (key === 'Enter' || key === 'Escape') {
      e.preventDefault();
      if (isHost()) net.setState({ gameLocked: true });
      else if (!isGuest()) game.end();
      return;
    }
    if (key === 'v' || key === 'V') { e.preventDefault(); game.toggleReference(); return; }
    if (key === 'b' || key === 'B') { e.preventDefault(); game.toggleBattery(); return; }
    // Restarting and clearing are single-machine concepts; in a room the scores
    // belong to the players, not to this console.
    if (session.mode === 'solo') {
      if (key === 'r' || key === 'R') { e.preventDefault(); game.restart(); return; }
      if (key === 'c' || key === 'C') { e.preventDefault(); game.clearBoard(); return; }
    } else if (isHost() && (key === 'c' || key === 'C')) {
      e.preventDefault();
      net.clearScores();
      return;
    }
  }

  if (step.type === 'scenario' && !isFormTarget(e)) {
    const s = step.scenario;
    if (key === '1' || key === 'a' || key === 'A') { e.preventDefault(); answer(s, 'a'); return; }
    if (key === '2' || key === 'b' || key === 'B') { e.preventDefault(); answer(s, 'b'); return; }
  }

  if (key === '0') {
    e.preventDefault();
    for (const k of Object.keys(answers)) delete answers[k];
    show(index, true);
    publishQuiz();
    return;
  }

  // arrows inside a slider/select adjust the control, not the deck
  if (isFormTarget(e) && (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown')) return;

  switch (key) {
    case 'ArrowRight': case 'PageDown': case ' ': case 'Spacebar':
      e.preventDefault(); next(); break;
    case 'ArrowLeft': case 'PageUp':
      e.preventDefault(); prev(); break;
    case 'Home': e.preventDefault(); goto(0); break;
    case 'End': e.preventDefault(); goto(STEPS.length - 1); break;
  }
});

document.getElementById('help-btn').addEventListener('click', () => helpEl.classList.remove('hidden'));
helpEl.addEventListener('click', e => { if (e.target === helpEl) helpEl.classList.add('hidden'); });
document.getElementById('session-panel')
  .addEventListener('click', e => { if (e.target.id === 'session-panel') toggleSessionPanel(false); });

/* ---------------------------------------------------------- room wiring */

/** Re-render the current step in place when room data changes underneath it. */
function refreshIfShowing(...types) {
  if (types.includes(STEPS[index]?.type)) show(index, true);
}

function wireRoom() {
  net.onState(s => {
    if (!s) return;
    const prev = { ...shared };
    Object.assign(shared, s);

    if (isGuest() && typeof s.step === 'number' && s.step !== index) show(s.step);

    // The presenter closing the round locks every console in the room.
    if (shared.gameLocked && !prev.gameLocked && game) game.end();

    if (shared.revealQuiz !== prev.revealQuiz) refreshIfShowing('board');
    if (shared.revealGame !== prev.revealGame && game) game.setSharedRows(gameRows, shared.revealGame);
  });

  net.onPlayers(list => setPlayerCount(list.length));
  net.onQuiz(rows => { quizRows = rows; refreshIfShowing('board'); });
  net.onGame(rows => {
    gameRows = rows;
    if (game) game.setSharedRows(rows, shared.revealGame);
  });

  if (isHost()) net.setState({ step: index });
}

/* ------------------------------------------------------------------ boot */

buildProgress();
track.addEventListener('click', e => {
  const i = e.target?.dataset?.i;
  if (i !== undefined) goto(Number(i));
});
startBg();

initSession().then(() => {
  document.body.classList.toggle('is-guest', isGuest());
  document.body.classList.toggle('is-host', isHost());
  if (session.mode === 'solo') {
    const fromHash = Number(location.hash.replace('#', ''));
    show(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0);
  } else {
    show(index);
    wireRoom();
  }
});
