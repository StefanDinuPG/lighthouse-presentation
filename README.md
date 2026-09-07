# The Autonomous Lighthouse Network

An interactive, presenter-driven technical talk (45–50 min) for a developer audience, built as a
static front-end app. No build step, no dependencies, no timers — you drive every beat.

## Run it

```bash
# any static server works; from the repo root:
python -m http.server 8080
# then open http://localhost:8080

# on Windows without Python, a bundled PowerShell server:
./serve.ps1          # http://127.0.0.1:8099
```

It uses ES modules, so open it over HTTP (not `file://`).

## Deploy to GitHub Pages

Push the repo and enable **Settings → Pages → Deploy from a branch → `main` / `root`**.
`.nojekyll` is included so the `js/` folder is served as-is.

### You must deploy before you can run a live session

`serve.ps1` binds to `127.0.0.1`, which is the address a machine uses to talk to
*itself*. It is perfect for writing and rehearsing, and **useless for an audience**:
a participant who types `http://127.0.0.1:8099/?r=CODE` is asking their own laptop
for the page, finds nothing there, and gets "unable to connect". The same is true of
`localhost`. A LAN address like `192.168.x.x` is only marginally better — it works
for people on that exact network and fails on most corporate or guest wifi.

Firebase syncs the slides and the scores, but it does not serve the app. The HTML,
CSS and JS still have to come from somewhere every participant can reach. That is
what GitHub Pages is for.

If you open the join panel while presenting from a loopback or private address, the
deck says so rather than handing out a link that cannot work.

Once deployed, present from `https://stefandinupg.github.io/lighthouse-presentation/` and everything
else is unchanged — same room codes, same scores, same keys.

## Presenter controls

| Key | Action |
| --- | --- |
| `→` `Space` `PgDn` | Next step |
| `←` `PgUp` | Previous step |
| `Home` / `End` | Jump to intro / final game |
| `1`/`A`, `2`/`B` | Answer option A or B in a scenario |
| `0` | Reset the scoreboard |
| `F` | Fullscreen |
| `?` | Keyboard help |

In the final game:

| Key | Action |
| --- | --- |
| `Enter` / `Esc` | **End the round** — lock all inputs, reveal the best settled fidelity, record it on the leaderboard |
| `R` | Reset for the next contestant — restores the default dashboard, keeps the leaderboard |
| `C` | Clear the leaderboard (in a live session: wipe both room leaderboards for a second run) |
| `V` | Show/hide the pristine reference feed |
| `B` | Toggle battery drain (safety valve for long sessions) |

While the final card is up, the **contestant name** field is focused — typing there never triggers the
hotkeys above. A round that never produced a settled reading is shown but not recorded, so a
mis-pressed `Enter` cannot pollute the board.

## Structure

```
index.html        shell: HUD, stage, progress rail, help overlay
styles.css        dark tech-dashboard theme
js/app.js         deck router, global keyboard, scoreboard, progress
js/content.js     all slide + scenario copy (8 scenarios, 2-3 sentence narratives)
js/lighthouse.js  deterministic procedural storm scene (cinematic bg + game source feed)
js/game.js        "Fix That Stream" simulation
js/config.js      Firebase config for live sessions (empty = solo only)
js/net.js         Realtime Database client; every method no-ops when offline
js/session.js     role detection (solo/host/guest), join overlay, room badge
js/board.js       shared leaderboard rendering with name masking
diagnose.html     open in a browser to test the Firebase setup step by step
serve.ps1         optional PowerShell static server for local preview
assets/           optional lighthouse.mp4
PRESENTER-NOTES.md  gitignored: game solution, debrief, day-of checklist
```

## Flow

1. **Intro** — cinematic storm frame, the persona (on call for 3,412 autonomous towers).
2. **Part 1 · The Pipeline** — link budget, edge vs cloud, buffers, backoff, transport, FEC, energy.
3. **Part 1 · Incidents** — S1 rogue wave, S2 wind shear, S3 seagull, S4 generator failure.
4. **Part 2 · The Payload** — spatial vs temporal, I/P frames and GOP, smearing, checksums,
   VBR vs CBR, pre-processing.
5. **Part 2 · Incidents** — S5 deep fog, S6 lightning, S7 midnight snow, S8 spreading glitch.
6. **Finale · Fix That Stream** — the live simulation.

The scoreboard (`SCORE x/8`) is untimed and persists across the scenario sections.

## The final game

A hidden `<video>` element is created and pointed at `assets/lighthouse.mp4`. If that file is not
present (the default), the app falls back to a **procedural storm scene** rendered on canvas — so the
app is fully self-contained. Drop any `lighthouse.mp4` into `assets/` and it will be used
automatically as the source feed instead.

Pipeline per animation frame:

```
source (procedural or <video>)
  -> ring buffer (60 frames of history)      # latency / jitter buffer delay
  -> spatial downscale + denoise blur        # resolution, pre-processing
  -> CBR quantisation blocking               # rate control starvation
  -> frame delivery gate                     # fps, packet loss, jitter, outages
  -> persistent corruption blocks (getImageData scramble + drift)   # hail, I/P frames
  -> visible <canvas>
```

**Fidelity** is a genuine pixel comparison between the received canvas and the sensor feed at
320×180, scored on four axes:

| Term | Weight | What it punishes |
| --- | --- | --- |
| Accuracy | 0.36 | mean absolute error — wrong pixels, garbage, a dead feed |
| Detail | 0.24 | block-pooled gradient error — blur, low resolution, corruption |
| Motion | 0.22 | block-pooled frame-delta error — freezes, drops, low fps, smear |
| Responsiveness | 0.18 | staleness: buffer depth **plus** time since the last frame landed |

### Reading the score during the round

Instantaneous fidelity swings with every gust, so it can never decide a winner. The `ROUND SCORE`
panel instead reports a **settled reading**: the mean fidelity over one complete 20-second storm
cycle in which nothing was changed.

To make that number meaningful the storm is built to **repeat exactly every 20 seconds** — the
weather curves are integer harmonics of the cycle, the RNG that places hail, drops and stalls is
re-seeded on every cycle boundary, the outage is scheduled at a fixed phase rather than rolled for,
and even the procedural scene (beam rotation, rain, waves, cloud drift, lightning) has its animation
rates snapped to harmonics of the cycle. Every configuration is therefore graded against *the same
20 seconds of weather*, which is what makes two contestants comparable at all. Measured
cycle-to-cycle drift of a settled reading is under 0.05 points.

The panel shows:

- the **settled value**, or `—` while it is being earned;
- a **state line**: `BASELINE · Ns` before the first change, `MEASURING · Ns` counting down the
  cycle after each change, `SETTLED` once the reading is valid, `LOCKED` when the round ends;
- a **progress bar** for that countdown;
- a **`BEST` line** with the highest settled reading so far and an arrow showing whether the current
  one beat it;
- a **sparkline** of the whole round — faint live fidelity, a solid cyan line at the settled value
  and a dashed amber line at the best.

Two consequences worth stating out loud in the room:

- **Changing a setting invalidates the reading.** The window now straddles two configurations, so
  it is thrown away and re-earned over a fresh cycle. Fiddling constantly means never scoring.
- **The untouched defaults do not count.** `BEST` only starts recording once the contestant has
  changed something, and the final card reports the best settled reading — not the last one — so a
  disastrous final experiment cannot destroy a good result. Each contestant also starts from the
  same default dashboard (`R` resets it).

`LIVE FIDELITY` remains as a separate panel showing the raw right-now value.

### The bandwidth cap, and why it binds

The 100% cap is the spine of the game, so it is built to be genuinely unbuyable:

- **Overrun costs drops *and* delay.** Past the cap you shed packets in proportion to the overshoot,
  and you also accumulate queueing delay (`congestion × 950 ms`) — bufferbloat. A saturated link
  feels laggy long before it looks broken, and that delay lands on the accuracy and motion terms.
- **FEC cannot repair congestion.** Parity shards let the receiver rebuild packets the *storm* knocked
  out, but they ride the same queue as the payload; once it overflows they are dropped alongside what
  they were meant to protect. FEC's own overhead also feeds back into the bandwidth figure, so
  redundancy is self-limiting. Piling on FEC to survive a link you have already overrun makes it worse.
- **The reference is aligned to *deliberate* latency only** — buffer depth, compute placement, frame
  pacing. So choosing a deep buffer is not itself an error (the S2 lesson). Involuntary delay
  (bufferbloat, TCP retransmits) is left unaligned and scores as the real error it is.

The net effect is that the only cure for overrun is to **want fewer bits**, which is exactly what edge
gating, a coarser resolution, a lower frame rate and pre-processing are for.

### Measured behaviour

The dashboard has been tuned so that every scenario lesson is reproducible on it: edge beats cloud,
exponential backoff beats aggressive retry, a checksum beats no checksum, shorter GOP beats
disabling P-frames, 720p beats 1080p, and a moderate buffer beats both a short and a long one. The
optimum is a **plateau, not a knife edge** — several quite different-looking dashboards land within
half a point of each other, so it rewards getting the architecture right rather than hunting for a
magic combination.

The measured score table, the tuned optimum and the debrief notes live in `PRESENTER-NOTES.md`,
which is gitignored and stays on the presenter's machine. This repo is public and GitHub Pages
serves every committed file, so publishing the solution would put it one URL away from the audience.

**Bandwidth** is capped at 100% of the storm-dependent link capacity, which itself falls as the wind
rises. Wind and hail roll in over the first 12 seconds and then repeat their 20-second cycle forever;
the round only ends when the presenter presses `Enter`.


## Running it as a live shared session

By default the deck is a single-machine presentation and needs no setup at all. If you want the
audience to follow along on their own laptops, answer the incidents and play the finale — with two
anonymised leaderboards you reveal on stage — attach a Firebase Realtime Database.

**This is optional.** Leave `js/config.js` empty and everything below simply does not exist: no
badge, no join screen, no network calls.

### One-time setup (about five minutes)

1. Create a project at <https://console.firebase.google.com>. No billing needed; the free
   Spark tier is far more than a room of 100 people will use.
2. **Build → Realtime Database → Create Database.** Pick a region near your audience and start in
   **locked mode** — the rules below replace the defaults.
3. **Build → Authentication → Get started → Anonymous → Enable.** Participants never see a login;
   this just gives each browser a stable identity so the rules can be meaningful.
4. **Project settings → General → Your apps → Web (`</>`)** and copy the config object.
5. Paste `apiKey`, `authDomain`, `databaseURL` and `projectId` into `FIREBASE` in `js/config.js`.
   These are **not secrets** — they are public identifiers and ship in every Firebase web app. The
   security rules are what protect the data.
6. Realtime Database → **Rules** tab, paste this, and Publish:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "auth != null",

        "meta": {
          ".write": "auth != null && (!data.exists() || data.child('host').val() === auth.uid)"
        },

        "state": {
          ".write": "auth != null && root.child('rooms').child($room).child('meta/host').val() === auth.uid"
        },

        "players": {
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        },

        "quiz": {
          ".write": "auth != null && root.child('rooms').child($room).child('meta/host').val() === auth.uid",
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        },

        "game": {
          ".write": "auth != null && root.child('rooms').child($room).child('meta/host').val() === auth.uid",
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        }
      }
    }
  }
}
```

Anyone in the room can read the room; a participant can only write their own name and their own two
scores; only the browser that claimed the room can move the slides, reveal names or clear the boards.

### Running the session

1. Open the deck. A **GO LIVE** button appears in the top bar. Press it — you get a fresh four-letter
   room code and the URL changes to `?r=CODE&host=1`. **That tab is now the presenter.** Keep it open;
   if you close it the room has no host.
2. The join panel comes up automatically. Press `S` to show or hide it at any time. Read the code out
   or let people copy the link: `…/index.html?r=CODE`.
3. Participants enter a name and land on whatever slide you are on. From then on they follow you —
   their arrow keys do nothing, so nobody can read ahead or fall behind.
4. They answer the eight incidents on their own machines. The badge shows how many have joined.
5. At the **incident leaderboard** slide the ranks and scores are visible but every name is a block of
   `▓` — except each viewer's own row, which is always legible and tagged `YOU`. Press `L` to reveal.
6. In the finale everyone plays the same storm on their own dashboard. When you press `Enter`, every
   console in the room locks at once and each player's best settled fidelity is submitted.
7. Press `L` again to reveal the final board. Press `C` to wipe both boards if you want to run it twice.

### Troubleshooting

Open **`diagnose.html`** in the same browser. It checks each stage in order --
config parsing, SDK download, anonymous sign-in, database read, database write --
and tells you exactly which one broke and what to click to fix it.

The two failures almost everyone hits:

| Symptom | Cause | Fix |
| --- | --- | --- |
| `auth/configuration-not-found` or the call just hangs | Authentication was never initialised on the project | Build -> Authentication -> **Get started** -> Sign-in method -> Anonymous -> Enable |
| `PERMISSION_DENIED` | The rules were never published, or went into Firestore's rules tab by mistake | Realtime Database -> **Rules** -> paste the block above -> Publish |

**The Rules Playground always says "denied" by default.** It simulates an
*unauthenticated* request, and every rule here begins with `auth != null`, so a
denial there is the rules working correctly rather than a fault. To simulate a
real participant, turn on the **Authenticated** toggle and put any string in the
Firebase UID box before pressing Run.

Note that `js/config.js` being correct is *not* enough on its own: the Anonymous
provider and the rules are two separate switches in the console, and the config
snippet is handed to you before either has been set.

### If the network misbehaves

Every network call is best-effort. If Firebase is unreachable, misconfigured or slow, the affected
browser falls back to the ordinary solo deck and says so — it never blocks, and it never leaves
someone staring at a spinner. A talk should not die because a database did.

The presenter's own play is never submitted to the final board, so you can demonstrate the dashboard
without appearing in the results.


