/**
 * Live-session glue: works out what role this browser is playing, gets a name
 * out of the audience, and owns the small amount of chrome that only exists
 * when a session is running (room badge, join panel, connection dot).
 *
 * Three modes:
 *   solo  — no room in the URL. Exactly the original single-machine deck.
 *   host  — ?r=CODE&host=1. Drives the room; everyone else follows.
 *   guest — ?r=CODE. Follows the host's step, plays, submits scores.
 */

import { Net, randomRoomCode, normaliseRoom } from './net.js';
import { NET_CONFIGURED } from './config.js';

export const net = new Net();
export const session = { mode: 'solo', ready: false, players: 0 };

const NAME_KEY = 'aln.name';

const $ = id => document.getElementById(id);

/** The link the audience types in. Deliberately short and free of state. */
export function joinURL(room) {
  const u = new URL(location.href);
  u.hash = '';
  u.search = `?r=${room}`;
  return u.toString();
}

/**
 * A loopback or private address is fine for the presenter but useless to the
 * audience: 127.0.0.1 means "this machine" on *their* laptop too, and a LAN IP
 * dies the moment someone is on guest wifi. Firebase syncs the scores, but the
 * page itself still has to come from somewhere everyone can reach. Worth saying
 * loudly, because the join panel otherwise shows a link that looks perfectly
 * fine and fails for every single participant.
 */
export function hostReachability(hostname = location.hostname) {
  const h = String(hostname || '');
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '') {
    return { ok: false, kind: 'loopback' };
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return { ok: false, kind: 'lan' };
  }
  return { ok: true, kind: 'public' };
}

/* ------------------------------------------------------------------ chrome */

function paintBadge() {
  const el = $('session-badge');
  if (!el) return;
  if (session.mode === 'solo') {
    el.className = NET_CONFIGURED ? 'session-badge offer' : 'session-badge hidden';
    el.innerHTML = NET_CONFIGURED
      ? '<button id="go-live" class="ghost-btn">● GO LIVE</button>' : '';
    $('go-live')?.addEventListener('click', startHosting);
    return;
  }
  const live = net.ok;
  el.className = 'session-badge' + (live ? ' live' : ' down');
  el.innerHTML = `
    <span class="sb-dot"></span>
    <span class="sb-room">${net.room}</span>
    ${session.mode === 'host'
      ? `<span class="sb-n">${session.players} JOINED</span>`
      : `<span class="sb-n">${escapeAttr(net.name)}</span>`}
    ${session.mode === 'host' ? '<button id="sess-btn" class="ghost-btn">LINK</button>' : ''}`;
  $('sess-btn')?.addEventListener('click', () => toggleSessionPanel(true));
}

const escapeAttr = s => String(s || '').replace(/[<>&"]/g, '');

export function setPlayerCount(n) {
  session.players = n;
  paintBadge();
  const c = $('sp-count');
  if (c) c.textContent = String(n);
}

/** The big "here is the link" panel the presenter puts on the projector. */
export function toggleSessionPanel(force) {
  const el = $('session-panel');
  if (!el) return;
  const show = force !== undefined ? force : el.classList.contains('hidden');
  el.classList.toggle('hidden', !show);
  if (!show) return;
  const url = joinURL(net.room);
  const reach = hostReachability();
  const warn = reach.ok ? '' : `
      <div class="sess-warn">
        <b>Nobody else can open this link.</b>
        ${reach.kind === 'loopback'
          ? `<span>${location.hostname || 'file://'} means &ldquo;this computer&rdquo; on every machine, so a
             participant typing it just reaches their own laptop and gets a connection error.</span>`
          : `<span>${location.hostname} is a private network address. It only works for people on this
             exact network, and not on most guest wifi.</span>`}
        <span>Publish the deck to GitHub Pages and present from that URL instead. The room code
        and everyone&rsquo;s scores work the same &mdash; only the address changes.</span>
      </div>`;
  el.innerHTML = `
    <div class="overlay-card sess-card">
      <div class="kicker">JOIN THE WATCH</div>
      <h2>Room <b class="sess-room">${net.room}</b></h2>
      <p class="muted">Open this on your laptop. You will follow the briefing and play the finale.</p>
      <div class="sess-url${reach.ok ? '' : ' bad'}" id="sp-url">${url}</div>
      ${warn}
      <div class="sess-actions">
        <button class="ghost-btn" id="sp-copy">COPY LINK</button>
        <span class="muted small"><b id="sp-count">${session.players}</b> connected</span>
      </div>
      <p class="muted small">Press <kbd>S</kbd> or <kbd>Esc</kbd> to close.</p>
    </div>`;
  $('sp-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      $('sp-copy').textContent = 'COPIED';
      setTimeout(() => { const b = $('sp-copy'); if (b) b.textContent = 'COPY LINK'; }, 1400);
    } catch { /* clipboard blocked — the URL is on screen anyway */ }
  });
}

/* -------------------------------------------------------------- host start */

function startHosting() {
  const room = randomRoomCode();
  const u = new URL(location.href);
  u.search = `?r=${room}&host=1`;
  location.href = u.toString();
}

/* --------------------------------------------------------------- join flow */

function askName(room) {
  return new Promise(resolve => {
    const el = $('join');
    const prior = localStorage.getItem(NAME_KEY) || '';
    el.className = 'overlay';
    el.innerHTML = `
      <div class="overlay-card join-card">
        <div class="kicker">AUTONOMOUS LIGHTHOUSE NETWORK</div>
        <h2>Join room <b class="sess-room">${room}</b></h2>
        <p class="muted">Pick the name you want on the leaderboard. Names stay hidden
          from the room until the reveal.</p>
        <form id="join-form" autocomplete="off">
          <input id="join-name" type="text" maxlength="22" placeholder="Your name"
                 value="${escapeAttr(prior)}" />
          <button type="submit" class="cta">TAKE THE WATCH</button>
        </form>
        <p class="muted small" id="join-msg"></p>
      </div>`;
    const input = $('join-name');
    setTimeout(() => input.focus(), 40);
    $('join-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = input.value.trim().slice(0, 22);
      if (!name) { input.focus(); return; }
      localStorage.setItem(NAME_KEY, name);
      el.className = 'overlay hidden';
      resolve(name);
    });
  });
}

function fatal(title, msg, code) {
  const el = $('join');
  el.className = 'overlay';
  el.innerHTML = `
    <div class="overlay-card join-card">
      <h2>${title}</h2>
      <p class="muted">${msg}</p>
      ${code ? `<p class="err-code">${escapeAttr(code)}</p>` : ''}
      <p class="muted small">You can keep watching — the deck still works on its own.</p>
      <button class="cta" onclick="document.getElementById('join').className='overlay hidden'">
        CONTINUE SOLO</button>
      <p class="muted small">Stuck? Open <b>diagnose.html</b> for a step-by-step check.</p>
    </div>`;
}

/**
 * Turn a Firebase error code into something a human can act on. The generic
 * "could not connect" message sends people hunting through their config when
 * the real cause is almost always one un-clicked toggle in the console.
 */
function explain(code) {
  const c = String(code || '');
  if (/configuration.not.found|operation-not-allowed|admin-restricted/i.test(c)) {
    return 'Anonymous sign-in is not enabled on the Firebase project. In the console: '
      + 'Build → Authentication → Get started → Sign-in method → Anonymous → Enable.';
  }
  if (/PERMISSION_DENIED|permission-denied/i.test(c)) {
    return 'The database rules are rejecting this browser. Paste the rules from README.md '
      + 'into Realtime Database → Rules and press Publish.';
  }
  if (/api-key|invalid-api-key/i.test(c)) {
    return 'The apiKey in js/config.js is not valid for this project.';
  }
  if (/unauthorized-domain/i.test(c)) {
    return `This domain (${location.hostname}) is not in Authentication → Settings → Authorised domains.`;
  }
  if (/network|unavailable|timeout|Failed to fetch/i.test(c)) {
    return 'Google\u2019s servers could not be reached — usually a VPN, proxy or firewall.';
  }
  return 'The database could not be reached. Check js/config.js and your connection.';
}

/* -------------------------------------------------------------------- init */

export async function initSession() {
  const q = new URLSearchParams(location.search);
  const room = normaliseRoom(q.get('r'));
  const wantHost = q.get('host') === '1';

  if (!room) { session.mode = 'solo'; paintBadge(); return session; }

  if (!NET_CONFIGURED) {
    session.mode = 'solo';
    paintBadge();
    fatal('Live sessions are not configured',
      'This deck has no Firebase project attached, so the room link cannot work. See README.md.');
    return session;
  }

  net.onStatus = () => paintBadge();

  // The host claims the room before anyone is asked for a name; a guest gives
  // their name first so the roster is never full of anonymous ghosts.
  if (wantHost) {
    const ok = await net.connect(room, true);
    if (!ok || !net.isHost) {
      session.mode = 'solo';
      paintBadge();
      fatal('Could not host that room',
        net.error === 'already-hosted'
          ? 'Another browser already hosts this room. Close it, or press GO LIVE for a fresh code.'
          : explain(net.error),
        net.error === 'already-hosted' ? null : net.error);
      return session;
    }
    session.mode = 'host';
    net.name = 'PRESENTER';
    session.ready = true;
    paintBadge();
    toggleSessionPanel(true);
    return session;
  }

  const name = await askName(room);
  const ok = await net.connect(room, false);
  if (!ok) {
    session.mode = 'solo';
    paintBadge();
    fatal('Could not join that room',
      net.error === 'no-such-room'
        ? 'That room does not exist yet. Check the code with the presenter.'
        : explain(net.error),
      net.error === 'no-such-room' ? null : net.error);
    return session;
  }
  await net.register(name);
  session.mode = 'guest';
  session.ready = true;
  paintBadge();
  return session;
}
