/**
 * Live-session configuration.
 *
 * Leave this file exactly as it is and the app runs the way it always has:
 * one machine, one presenter, a local leaderboard, no network at all.
 *
 * Fill in FIREBASE below and the app additionally becomes a shared session —
 * the audience follows your slides on their own laptops, answers the incidents,
 * plays the finale, and their scores land on two shared leaderboards.
 *
 * See the "Running it as a live shared session" section of README.md for the
 * five-minute setup. These values are NOT secrets: Firebase client config is
 * designed to ship in public code, and the database rules are what actually
 * protect the room.
 */
export const FIREBASE = {
  apiKey: "AIzaSyB8p49qRzDpLDzsSxrzsHbBJUzaI0OHpAI",
  authDomain: "the-lighthouse-teachmesensei.firebaseapp.com",
  databaseURL: "https://the-lighthouse-teachmesensei-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "the-lighthouse-teachmesensei"
};

/** True once the deck has somewhere to sync to. */
export const NET_CONFIGURED = Boolean(FIREBASE.databaseURL && FIREBASE.apiKey);

/** Pinned so a future SDK release cannot break a talk you are about to give. */
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

/** How many rows the shared leaderboards show before collapsing the tail. */
export const BOARD_TOP_N = 10;
