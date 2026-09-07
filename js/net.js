/**
 * Shared-session transport.
 *
 * Everything here is optional and defensive. If Firebase is not configured, the
 * network is unreachable, or any call fails, `Net.ok` stays false and every
 * method becomes a no-op — the deck then behaves exactly as the single-machine
 * version. A talk must never die because a database did.
 *
 * Data model (Realtime Database):
 *
 *   rooms/{code}/
 *     meta/   { host: uid, createdAt }
 *     state/  { step, gameLocked, revealQuiz, revealGame }   <- host writes only
 *     players/{uid}/ { name, at }
 *     quiz/{uid}/    { name, score, at }
 *     game/{uid}/    { name, score, grade, changes, peak, at }
 */

import { FIREBASE, NET_CONFIGURED, FIREBASE_SDK } from './config.js';

/** Rooms are read aloud, so avoid the glyphs people mishear or mistype. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode(n = 4) {
  let s = '';
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function normaliseRoom(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/**
 * A blocked proxy makes Firebase hang rather than fail, which would leave the
 * presenter staring at a dead screen with a room full of people waiting. Cap it.
 */
function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => {
    const e = new Error(`${label} timed out after ${ms / 1000}s`);
    e.code = 'timeout';
    rej(e);
  }, ms))]);
}

export class Net {
  constructor() {
    this.ok = false;
    this.configured = NET_CONFIGURED;
    this.room = null;
    this.uid = null;
    this.isHost = false;
    this.name = '';
    this.error = null;
    this._db = null;
    this._fns = null;
    this._unsubs = [];
    /** Fired whenever the connection flips, so the HUD can show the truth. */
    this.onStatus = () => {};
  }

  /**
   * Join (or, for the host, create) a room.
   * Resolves either way — check `.ok`. Never throws.
   */
  async connect(room, wantHost) {
    if (!this.configured) { this.error = 'not-configured'; return false; }
    this.room = normaliseRoom(room);
    if (!this.room) { this.error = 'no-room'; return false; }

    try {
      const [{ initializeApp }, auth, db] = await Promise.all([
        import(`${FIREBASE_SDK}firebase-app.js`),
        import(`${FIREBASE_SDK}firebase-auth.js`),
        import(`${FIREBASE_SDK}firebase-database.js`),
      ]);

      const app = initializeApp(FIREBASE);
      const a = auth.getAuth(app);
      const cred = await withTimeout(auth.signInAnonymously(a), 15000, 'Sign-in');
      this.uid = cred.user.uid;

      this._db = db.getDatabase(app);
      this._fns = db;

      const metaRef = db.ref(this._db, `rooms/${this.room}/meta`);
      const snap = await withTimeout(db.get(metaRef), 15000, 'Database read');

      if (wantHost) {
        if (!snap.exists()) {
          await db.set(metaRef, { host: this.uid, createdAt: db.serverTimestamp() });
          this.isHost = true;
        } else if (snap.val().host === this.uid) {
          this.isHost = true;                       // resumed after a refresh
        } else {
          this.error = 'already-hosted';
          this.isHost = false;
        }
      } else if (!snap.exists()) {
        this.error = 'no-such-room';
        return false;
      }

      // Surface real connectivity rather than assuming it.
      const connRef = db.ref(this._db, '.info/connected');
      this._unsubs.push(db.onValue(connRef, s => {
        this.ok = s.val() === true;
        this.onStatus(this.ok);
      }));

      this.ok = true;
      this.onStatus(true);
      return true;
    } catch (e) {
      this.error = e?.code || e?.message || 'connect-failed';
      this.ok = false;
      this.onStatus(false);
      return false;
    }
  }

  _ref(path) { return this._fns.ref(this._db, `rooms/${this.room}/${path}`); }

  _watch(path, cb) {
    if (!this._db) return () => {};
    try {
      const off = this._fns.onValue(this._ref(path), s => cb(s.val()), () => cb(null));
      this._unsubs.push(off);
      return off;
    } catch { return () => {}; }
  }

  async _write(path, value, merge) {
    if (!this._db) return;
    try {
      const r = this._ref(path);
      await (merge ? this._fns.update(r, value) : this._fns.set(r, value));
    } catch (e) { this.error = e?.code || 'write-failed'; }
  }

  /* ------------------------------------------------------------ presenter */

  /** Host only; ignored by the rules for everyone else. */
  setState(patch) {
    if (!this.isHost) return;
    this._write('state', patch, true);
  }

  onState(cb) { return this._watch('state', cb); }

  /* ---------------------------------------------------------- participant */

  async register(name) {
    this.name = name;
    if (!this._db) return;
    // Drop the roster entry if the laptop lid closes, but keep the scores:
    // someone who steps out should not vanish from the leaderboard.
    try {
      const r = this._ref(`players/${this.uid}`);
      this._fns.onDisconnect(r).remove();
      await this._fns.set(r, { name, at: this._fns.serverTimestamp() });
    } catch { /* roster is cosmetic — never block on it */ }
  }

  submitQuiz(score, total) {
    if (!this._db) return;   // serverTimestamp() is only available once connected
    this._write(`quiz/${this.uid}`, {
      name: this.name, score, total, at: this._fns.serverTimestamp(),
    });
  }

  submitGame(entry) {
    if (!this._db) return;
    this._write(`game/${this.uid}`, {
      name: this.name, ...entry, at: this._fns.serverTimestamp(),
    });
  }

  onPlayers(cb) { return this._watch('players', v => cb(v ? Object.values(v) : [])); }

  onQuiz(cb) { return this._watch('quiz', v => cb(this._rows(v))); }

  onGame(cb) { return this._watch('game', v => cb(this._rows(v))); }

  _rows(v) {
    if (!v) return [];
    return Object.entries(v).map(([uid, r]) => ({ ...r, uid, mine: uid === this.uid }));
  }

  /** Host only — wipes both boards for a second run of the session. */
  async clearScores() {
    if (!this.isHost) return;
    await this._write('quiz', null);
    await this._write('game', null);
  }

  destroy() {
    for (const off of this._unsubs) { try { off(); } catch { /* already gone */ } }
    this._unsubs = [];
    this.ok = false;
  }
}
