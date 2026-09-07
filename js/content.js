/** Deck content: slides + the 8 interactive scenarios. Pure data, no DOM. */

const fig = (inner, vb = '0 0 420 250') =>
  `<figure><svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">
   <defs>
     <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#3fe0d0"/><stop offset="1" stop-color="#3fe0d0" stop-opacity="0"/></linearGradient>
     <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
             markerUnits="userSpaceOnUse" orient="auto">
       <path d="M0 0 L10 5 L0 10 z" fill="#3fe0d0"/></marker>
     <marker id="ara" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
             markerUnits="userSpaceOnUse" orient="auto">
       <path d="M0 0 L10 5 L0 10 z" fill="#ffb454"/></marker>
     <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
             markerUnits="userSpaceOnUse" orient="auto">
       <path d="M0 0 L10 5 L0 10 z" fill="#ff4d6a"/></marker>
   </defs>${inner}</svg></figure>`;

const F = {
  s: 'font-family="ui-monospace,monospace" font-size="10" letter-spacing="1.4"',
  box: 'fill="rgba(15,26,37,.9)" stroke="rgba(90,140,170,.35)" rx="6"',
};

/* ---------------------------------------------------------------- figures */

const figLinkBudget = fig(`
  <g ${F.s} fill="#7b90a4">
    ${[['BANDWIDTH', 0.72, '#3fe0d0'], ['LATENCY', 0.38, '#9b8cff'], ['JITTER', 0.55, '#ffb454'], ['LOSS', 0.24, '#ff4d6a']]
    .map(([n, v, c], i) => `
      <text x="0" y="${34 + i * 52}">${n}</text>
      <rect x="0" y="${42 + i * 52}" width="420" height="10" rx="5" fill="rgba(255,255,255,.07)"/>
      <rect x="0" y="${42 + i * 52}" width="${420 * v}" height="10" rx="5" fill="${c}" opacity=".85"/>
      <text x="415" y="${34 + i * 52}" text-anchor="end" fill="${c}">${Math.round(v * 100)}%</text>`).join('')}
  </g>`);

const figEdgeCloud = fig(`
  <g ${F.s}>
    <rect x="6" y="30" width="86" height="58" ${F.box}/>
    <text x="49" y="55" text-anchor="middle" fill="#c6d6e4">TOWER</text>
    <text x="49" y="70" text-anchor="middle" fill="#7b90a4">CAMERA</text>
    <rect x="326" y="30" width="88" height="58" ${F.box}/>
    <text x="370" y="63" text-anchor="middle" fill="#c6d6e4">CLOUD</text>

    <rect x="96" y="51" width="196" height="16" fill="#ff4d6a" opacity=".5"/>
    <polygon points="292,41 324,59 292,77" fill="#ff4d6a" opacity=".5"/>
    <text x="200" y="24" text-anchor="middle" fill="#ff4d6a">RAW 4K · 12 Mbps · 100% UPLINK</text>

    <rect x="6" y="150" width="86" height="58" ${F.box}/>
    <text x="49" y="175" text-anchor="middle" fill="#c6d6e4">TOWER</text>
    <text x="49" y="190" text-anchor="middle" fill="#7b90a4">+ NPU</text>
    <rect x="120" y="152" width="74" height="54" fill="rgba(63,224,208,.10)" stroke="#3fe0d0" rx="6"/>
    <text x="157" y="175" text-anchor="middle" fill="#3fe0d0">EDGE ML</text>
    <text x="157" y="190" text-anchor="middle" fill="#7b90a4">GATE</text>
    <rect x="326" y="150" width="88" height="58" ${F.box}/>
    <text x="370" y="183" text-anchor="middle" fill="#c6d6e4">CLOUD</text>
    <rect x="94" y="172" width="24" height="14" fill="#ff4d6a" opacity=".5"/>
    <rect x="198" y="177" width="94" height="4" fill="#3fe0d0"/>
    <polygon points="292,173 322,179 292,185" fill="#3fe0d0"/>
    <text x="258" y="146" text-anchor="middle" fill="#3fe0d0">EVENTS ONLY · 0.4 Mbps</text>
  </g>`);

const figBuffer = fig(`
  <g ${F.s}>
    <text x="0" y="22" fill="#7b90a4">ARRIVAL (JITTERED)</text>
    ${[8, 26, 30, 74, 96, 100, 104, 150, 190, 196].map(x =>
      `<rect x="${x}" y="34" width="9" height="22" rx="2" fill="#ffb454" opacity=".8"/>`).join('')}
    <rect x="0" y="90" width="420" height="46" rx="8" fill="rgba(63,224,208,.08)" stroke="#3fe0d0"/>
    <text x="210" y="118" text-anchor="middle" fill="#3fe0d0">JITTER BUFFER — HOLD, REORDER, RELEASE ON A CLOCK</text>
    <text x="0" y="176" fill="#7b90a4">PLAYOUT (SMOOTH, LATER)</text>
    ${Array.from({ length: 10 }, (_, i) =>
      `<rect x="${60 + i * 34}" y="188" width="9" height="22" rx="2" fill="#3fe0d0" opacity=".85"/>`).join('')}
    <line x1="0" y1="199" x2="52" y2="199" stroke="#9b8cff" stroke-dasharray="3 3"/>
    <text x="0" y="232" fill="#9b8cff">+DELAY</text>
  </g>`);

const figBackoff = fig(`
  <g ${F.s}>
    <text x="0" y="20" fill="#ff4d6a">AGGRESSIVE RETRY — 3,412 TOWERS, SAME MILLISECOND</text>
    ${Array.from({ length: 26 }, (_, i) =>
      `<rect x="${i * 16}" y="30" width="7" height="${18 + (i % 4) * 4}" fill="#ff4d6a" opacity=".8"/>`).join('')}
    <text x="0" y="86" fill="#7b90a4">→ SELF-INFLICTED DDOS ON YOUR OWN INGEST TIER</text>

    <text x="0" y="140" fill="#3fe0d0">EXPONENTIAL BACKOFF + JITTER</text>
    ${[0, 26, 70, 150, 300].map((x, i) =>
      `<rect x="${x}" y="150" width="7" height="22" fill="#3fe0d0" opacity=".85"/>
       <text x="${x}" y="188" fill="#7b90a4">${[1, 2, 4, 8, 16][i]}s</text>`).join('')}
    <path d="M0 214 C120 214 240 206 418 202" stroke="url(#fade)" fill="none" stroke-width="2"/>
    <text x="0" y="238" fill="#7b90a4">→ HERD DE-SYNCHRONISED, INGEST SURVIVES</text>
  </g>`);

const figTransport = fig(`
  <g ${F.s}>
    <text x="0" y="20" fill="#9b8cff">TCP — RELIABLE, ORDERED, STALLS</text>
    ${[0, 1, 2, 3, 4, 5].map(i =>
      `<rect x="${i * 44}" y="30" width="34" height="24" rx="3" fill="${i === 3 ? 'rgba(255,77,106,.25)' : 'rgba(155,140,255,.18)'}" stroke="${i === 3 ? '#ff4d6a' : '#9b8cff'}"/>
       <text x="${i * 44 + 17}" y="47" text-anchor="middle" fill="#c6d6e4">${i}</text>`).join('')}
    <path d="M167 58 L167 86" stroke="#ff4d6a" fill="none" marker-end="url(#arr)"/>
    <text x="0" y="116" fill="#ff4d6a">RETRANSMIT → HEAD-OF-LINE BLOCKING → +400 MS</text>

    <text x="0" y="160" fill="#3fe0d0">UDP + CHECKSUM — LOSSY, LIVE</text>
    ${[0, 1, 2, 3, 4, 5].map(i =>
      `<rect x="${i * 44}" y="170" width="34" height="24" rx="3" fill="${i === 3 ? 'rgba(255,77,106,.12)' : 'rgba(63,224,208,.14)'}" stroke="${i === 3 ? '#ff4d6a' : '#3fe0d0'}" ${i === 3 ? 'stroke-dasharray="3 3"' : ''}/>
       <text x="${i * 44 + 17}" y="187" text-anchor="middle" fill="${i === 3 ? '#ff4d6a' : '#c6d6e4'}">${i === 3 ? '✕' : i}</text>`).join('')}
    <text x="0" y="228" fill="#7b90a4">ONE BAD FRAME DIES. THE FEED KEEPS MOVING.</text>
  </g>`);

const figEnergy = fig(`
  <g ${F.s}>
    ${[['RADIO TX / UPLINK', 0.62, '#ff4d6a'], ['ENCODE + NPU', 0.18, '#ffb454'], ['SENSOR + HEATERS', 0.13, '#9b8cff'], ['NAV LAMP (LED)', 0.07, '#3fe0d0']]
    .map(([n, v, c], i) => `
      <text x="0" y="${30 + i * 56}" fill="#7b90a4">${n}</text>
      <rect x="0" y="${38 + i * 56}" width="420" height="14" rx="7" fill="rgba(255,255,255,.06)"/>
      <rect x="0" y="${38 + i * 56}" width="${420 * v}" height="14" rx="7" fill="${c}" opacity=".85"/>
      <text x="416" y="${30 + i * 56}" text-anchor="end" fill="${c}">${Math.round(v * 100)}%</text>`).join('')}
  </g>`);

const figSpatialTemporal = fig(`
  <g ${F.s}>
    <text x="0" y="18" fill="#3fe0d0">SPATIAL — HOW MUCH DETAIL PER FRAME</text>
    ${Array.from({ length: 8 * 4 }, (_, i) =>
      `<rect x="${(i % 8) * 22}" y="${28 + Math.floor(i / 8) * 22}" width="20" height="20" fill="rgba(63,224,208,${0.08 + (i % 5) * 0.05})"/>`).join('')}
    ${Array.from({ length: 2 * 2 }, (_, i) =>
      `<rect x="${230 + (i % 2) * 46}" y="${28 + Math.floor(i / 2) * 46}" width="44" height="44" fill="rgba(255,180,84,${0.1 + i * 0.06})"/>`).join('')}
    <text x="0" y="140" fill="#7b90a4">1080p ↔ 144p</text>

    <text x="0" y="180" fill="#ffb454">TEMPORAL — HOW OFTEN YOU LOOK</text>
    ${Array.from({ length: 15 }, (_, i) =>
      `<rect x="${i * 15}" y="190" width="11" height="26" rx="2" fill="rgba(255,180,84,.75)"/>`).join('')}
    ${[0, 1, 2].map(i =>
      `<rect x="${260 + i * 54}" y="190" width="11" height="26" rx="2" fill="rgba(255,180,84,.75)"/>`).join('')}
    <text x="0" y="236" fill="#7b90a4">30 fps ↔ 1 fps · SAME BITS, DIFFERENT TRUTH</text>
  </g>`);

const figGop = fig(`
  <g ${F.s}>
    ${Array.from({ length: 9 }, (_, i) => {
      const key = i % 4 === 0;
      return `<rect x="${i * 46}" y="60" width="38" height="52" rx="4"
        fill="${key ? 'rgba(63,224,208,.18)' : 'rgba(155,140,255,.12)'}" stroke="${key ? '#3fe0d0' : '#9b8cff'}"/>
        <text x="${i * 46 + 19}" y="92" text-anchor="middle" fill="${key ? '#3fe0d0' : '#9b8cff'}">${key ? 'I' : 'P'}</text>
        <text x="${i * 46 + 19}" y="132" text-anchor="middle" fill="#7b90a4">${key ? '48 kB' : '3 kB'}</text>`;
    }).join('')}
    <line x1="0" y1="26" x2="176" y2="26" stroke="#3fe0d0" marker-end="url(#ar)"/>
    <text x="0" y="18" fill="#3fe0d0">GOP = 4</text>
    <text x="0" y="176" fill="#7b90a4">I-FRAME = FULL TRUTH, EXPENSIVE.</text>
    <text x="0" y="196" fill="#7b90a4">P-FRAME = "WHAT CHANGED", CHEAP — AND DEPENDENT.</text>
    <text x="0" y="222" fill="#ffb454">SHORTER GOP = MORE BITS, FASTER RECOVERY.</text>
  </g>`);

const figSmear = fig(`
  <g ${F.s}>
    ${Array.from({ length: 8 }, (_, i) => {
      const key = i === 0;
      const rot = i >= 2;
      const w = 8 + (rot ? (i - 1) * 7 : 0);
      return `<rect x="${i * 52}" y="50" width="44" height="60" rx="4"
        fill="${key ? 'rgba(63,224,208,.16)' : 'rgba(155,140,255,.10)'}" stroke="${key ? '#3fe0d0' : '#9b8cff'}"/>
        <text x="${i * 52 + 22}" y="40" text-anchor="middle" fill="${key ? '#3fe0d0' : '#9b8cff'}">${key ? 'I' : 'P'}</text>
        ${i >= 1 ? `<rect x="${i * 52 + 6}" y="${64 + (i - 1) * 2}" width="${Math.min(w, 34)}" height="${Math.min(10 + i * 3, 34)}" fill="#ff4d6a" opacity=".75"/>` : ''}`;
    }).join('')}
    <text x="52" y="140" fill="#ff4d6a">▲ ONE CORRUPT BLOCK…</text>
    <text x="52" y="160" fill="#ff4d6a">…INHERITED AND DRAGGED FORWARD BY EVERY DELTA.</text>
    <rect x="0" y="186" width="420" height="46" rx="8" fill="rgba(63,224,208,.07)" stroke="#3fe0d0"/>
    <text x="210" y="214" text-anchor="middle" fill="#3fe0d0">FIX: SEND A FULL STATE (I-FRAME) MORE OFTEN</text>
  </g>`);

const figChecksum = fig(`
  <g ${F.s}>
    <text x="0" y="20" fill="#7b90a4">PAYLOAD</text>
    ${'01101001'.split('').map((b, i) => `
      <rect x="${i * 40}" y="32" width="32" height="32" rx="4" fill="${i === 4 ? 'rgba(255,77,106,.2)' : 'rgba(15,26,37,.9)'}" stroke="${i === 4 ? '#ff4d6a' : 'rgba(90,140,170,.35)'}"/>
      <text x="${i * 40 + 16}" y="53" text-anchor="middle" fill="${i === 4 ? '#ff4d6a' : '#c6d6e4'}">${i === 4 ? '1' : b}</text>`).join('')}
    <text x="176" y="84" text-anchor="middle" fill="#ff4d6a">↑ EMI BIT FLIP</text>

    <rect x="0" y="96" width="200" height="58" ${F.box} stroke="#ff4d6a"/>
    <text x="100" y="120" text-anchor="middle" fill="#ff4d6a">TLS / CIPHER STREAM</text>
    <text x="100" y="140" text-anchor="middle" fill="#7b90a4">MAC FAILS → SESSION DIES</text>

    <rect x="220" y="96" width="200" height="58" ${F.box} stroke="#3fe0d0"/>
    <text x="320" y="120" text-anchor="middle" fill="#3fe0d0">UDP CHECKSUM</text>
    <text x="320" y="140" text-anchor="middle" fill="#7b90a4">BAD DATAGRAM → ONE FRAME</text>

    <text x="0" y="196" fill="#7b90a4">BLAST RADIUS IS THE WHOLE DESIGN QUESTION:</text>
    <text x="0" y="218" fill="#ffb454">ONE FRAME, OR THE WHOLE SESSION?</text>
  </g>`);

const figFEC = fig(`
  <g ${F.s}>
    <text x="0" y="16" fill="#7b90a4">SEND 4 DATA SHARDS + 2 PARITY SHARDS (50% OVERHEAD)</text>
    ${['D1', 'D2', 'D3', 'D4'].map((d, i) =>
      `<rect x="${i * 56}" y="28" width="48" height="30" rx="4" fill="rgba(63,224,208,.14)" stroke="#3fe0d0"/>
       <text x="${i * 56 + 24}" y="48" text-anchor="middle" fill="#c6d6e4">${d}</text>`).join('')}
    ${['P1', 'P2'].map((p, i) =>
      `<rect x="${224 + i * 56}" y="28" width="48" height="30" rx="4" fill="rgba(155,140,255,.16)" stroke="#9b8cff"/>
       <text x="${248 + i * 56}" y="48" text-anchor="middle" fill="#c6d6e4">${p}</text>`).join('')}

    <text x="0" y="92" fill="#ff4d6a">STORM EATS ANY TWO OF THE SIX</text>
    ${[0, 1, 2, 3, 4, 5].map(i => {
      const lost = i === 1 || i === 4;
      return `<rect x="${i * 56}" y="104" width="48" height="30" rx="4"
        fill="${lost ? 'rgba(255,77,106,.14)' : 'rgba(90,140,170,.10)'}"
        stroke="${lost ? '#ff4d6a' : 'rgba(90,140,170,.45)'}" ${lost ? 'stroke-dasharray="3 3"' : ''}/>
       <text x="${i * 56 + 24}" y="124" text-anchor="middle" fill="${lost ? '#ff4d6a' : '#7b90a4'}">${lost ? '✕' : ['D1', 'D2', 'D3', 'D4', 'P1', 'P2'][i]}</text>`;
    }).join('')}

    <path d="M167 142 L167 164" stroke="#3fe0d0" fill="none" marker-end="url(#ar)"/>
    <text x="0" y="190" fill="#3fe0d0">ANY 4 OF THE 6 REBUILD ALL 4 DATA SHARDS</text>
    <text x="0" y="212" fill="#7b90a4">NO RETRANSMIT. NO ROUND TRIP. NO SESSION RESET.</text>
    <text x="0" y="234" fill="#ffb454">LOSE A THIRD SHARD AND IT ALL DIES. FEC IS INSURANCE.</text>
  </g>`);

const figDenoise = fig(`
  <g ${F.s}>
    <text x="0" y="16" fill="#ff4d6a">RAW NOISY FRAME → ENCODER</text>
    <rect x="0" y="26" width="150" height="86" rx="6" fill="#0b131c" stroke="rgba(255,77,106,.5)"/>
    ${Array.from({ length: 170 }, (_, i) => {
      const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const r2 = Math.abs(Math.sin(i * 78.233) * 12345.6789) % 1;
      const r3 = Math.abs(Math.sin(i * 4.1414) * 9876.54321) % 1;
      return `<rect x="${(4 + r1 * 142).toFixed(1)}" y="${(30 + r2 * 78).toFixed(1)}" width="2" height="2" fill="rgba(200,220,235,${(0.15 + r3 * 0.7).toFixed(2)})"/>`;
    }).join('')}
    <rect x="176" y="60" width="244" height="18" rx="9" fill="rgba(255,77,106,.22)" stroke="#ff4d6a"/>
    <text x="298" y="73" text-anchor="middle" fill="#ff4d6a">6.2 Mbps</text>

    <text x="0" y="150" fill="#3fe0d0">LOW-PASS PRE-FILTER → ENCODER</text>
    <rect x="0" y="160" width="150" height="60" rx="6" fill="#0b131c" stroke="rgba(63,224,208,.5)"/>
    ${Array.from({ length: 5 }, (_, i) =>
      `<rect x="8" y="${170 + i * 11}" width="${120 - i * 14}" height="5" rx="2.5" fill="rgba(200,220,235,.10)"/>`).join('')}
    <rect x="176" y="181" width="86" height="18" rx="9" fill="rgba(63,224,208,.22)" stroke="#3fe0d0"/>
    <text x="219" y="194" text-anchor="middle" fill="#3fe0d0">2.1 Mbps</text>
    <text x="276" y="194" fill="#7b90a4">SAME CRACK,</text>
    <text x="276" y="208" fill="#7b90a4">A THIRD OF THE BITS</text>
  </g>`);

const figRate = fig(`
  <g ${F.s}>
    <text x="0" y="18" fill="#ffb454">VBR — QUALITY LOCKED, BITRATE SPIKES</text>
    <path d="M0 80 L40 76 L80 82 L120 40 L160 30 L200 36 L240 78 L280 74 L320 80 L360 44 L418 38"
      fill="none" stroke="#ffb454" stroke-width="2"/>
    <line x1="0" y1="34" x2="418" y2="34" stroke="#ff4d6a" stroke-dasharray="4 4"/>
    <text x="418" y="28" text-anchor="end" fill="#ff4d6a">LINK CAP</text>

    <text x="0" y="146" fill="#3fe0d0">CBR — BITRATE LOCKED, QUALITY SPIKES DOWN</text>
    <path d="M0 190 L418 190" fill="none" stroke="#3fe0d0" stroke-width="2"/>
    ${[120, 160, 360].map(x => `<rect x="${x}" y="176" width="34" height="28" fill="rgba(255,77,106,.25)"/>`).join('')}
    <text x="0" y="234" fill="#7b90a4">VBR — NEVER UGLY, SOMETIMES TOO EXPENSIVE.</text>
    <text x="0" y="248" fill="#7b90a4">CBR — NEVER TOO EXPENSIVE, SOMETIMES UGLY.</text>
  </g>`);

/* -------------------------------------------------------------- scenarios */

export const SCENARIOS = [
  {
    code: 'S1', part: 1, title: 'The Rogue Wave',
    telemetry: ['TOWER LK-088', 'UPLINK: DOWN', 'PEERS RECONNECTING: 1,000'],
    story: `A category 4 wave just submerged Lighthouse 88. The connection dropped, and the system is attempting to restore the feed. All 1,000 regional lighthouses run the same reconnection logic against a shared mainland server cluster.`,
    a: 'Fire continuous reconnect requests until the feed comes back — every second of downtime is a second of blind coastline.',
    b: 'Wait a randomized interval before each reconnect attempt, even though this delays recovery for this specific tower.',
    correct: 'b',
    resultOk: 'Correct. The herd de-synchronises and the ingest tier survives to serve everyone.',
    resultNo: 'Locally reasonable, globally fatal — 1,000 towers retrying in lockstep is a DDoS you wrote yourself.',
    lesson: 'Exponential backoff with jitter prevents the thundering herd. Locally optimal behavior (reconnect ASAP) becomes globally catastrophic when 1,000 clients do it in sync.',
  },
  {
    code: 'S2', part: 1, title: 'The Wind Shear',
    telemetry: ['TOWER LK-207', 'REORDER: 18%', 'FEED: ONE-WAY'],
    story: `Gale winds are physically swaying the antenna. Packets are still arriving, but heavily out of sequence. This is a one-way structural monitoring feed, not a live conversation.`,
    a: 'Increase the jitter buffer so packets can be reordered before playback, accepting added latency.',
    b: 'Drop late-arriving packets and let forward error correction reconstruct the gaps, preserving real-time delivery.',
    correct: 'a',
    resultOk: 'Correct. Nobody is waiting on a reply, so latency is the cheapest thing you own here.',
    resultNo: 'You just protected a latency budget that no human in this loop actually needs.',
    lesson: 'Latency vs. integrity is a trade-off, not a right answer. One-way monitoring feeds can absorb buffer delay for cleaner output; interactive systems (VoIP, gaming) cannot.',
  },
  {
    code: 'S3', part: 1, title: 'The Seagull',
    telemetry: ['TOWER LK-063', 'MOTION EVENTS: 4,190/h', 'EGRESS: 96% OF BUDGET'],
    story: `A bird is nesting on the lens. The naive motion detector fires on every feather twitch, and the resulting footage is consuming the monthly satellite data budget. Your team already pays for a state-of-the-art computer vision service in AWS that can distinguish a seagull from a smuggler with 99.4% accuracy.`,
    a: 'Route the feed through your existing cloud CV pipeline — you already own the license, the model is best-in-class, and centralizing inference means one place to update, monitor, and audit.',
    b: 'Deploy a smaller 78%-accurate model onto the lighthouse\u2019s aging local hardware, duplicating logic you already have in the cloud and accepting more false positives.',
    correct: 'b',
    resultOk: 'Correct. The worse model wins because it is on the right side of the constraint.',
    resultNo: 'Every argument for the cloud model is true — and you still paid full uplink price for 4,190 pictures of a seagull.',
    lesson: 'Edge computing saves bandwidth <i>at the source</i>. The cloud model is better in every dimension except the one that matters here: it requires you to transmit the data you\u2019re trying to avoid transmitting. "We already own it" and "it\u2019s more accurate" are real considerations — but they don\u2019t change physics. Place computation where the constraint lives.',
  },
  {
    code: 'S4', part: 1, title: 'The Generator Failure',
    telemetry: ['TOWER LK-088', 'GEN: FLOODED', 'BATTERY: 2h 04m'],
    story: `The main diesel generator is flooded. You have roughly 2 hours of battery to keep structural monitoring alive until repair crews arrive.`,
    a: 'Dim the high-powered infrared LED array — a large, visible power draw on the equipment.',
    b: 'Drop the video framerate from 30 fps to 5 fps, reducing how much data the radio has to transmit.',
    correct: 'b',
    resultOk: 'Correct. The transmitter is the load that matters; the array is rounding error next to it.',
    resultNo: 'The LED array looks expensive because you can see it. The radio amplifier is an order of magnitude worse.',
    lesson: 'Energy-aware architecture. In most IoT devices, radio I/O dominates the power budget — often by an order of magnitude over sensors or illumination. Optimize the transmitter first, not the peripherals that <i>look</i> expensive.',
  },
  {
    code: 'S5', part: 2, title: 'The Deep Fog',
    telemetry: ['TOWER LK-141', 'LINK: 500 kbps', 'TASK: STRUCTURAL INSPECT'],
    story: `Heavy fog has choked your microwave link down to 500 kbps. Structural engineers need visual confirmation of hairline concrete fractures on the tower.`,
    a: 'Preserve 30 fps motion smoothness but drop the resolution to 144p.',
    b: 'Preserve 1080p resolution but drop the framerate to 1 frame per second.',
    correct: 'b',
    resultOk: 'Correct. A crack is a spatial signal, so spend every bit you have on pixels.',
    resultNo: 'At 144p a hairline fracture is smaller than a pixel — 30 smooth frames per second of nothing useful.',
    lesson: 'Spatial vs. temporal resolution should be chosen by use case. A static defect (a crack) needs pixels, not frames. Match the encoding trade-off to what the downstream consumer is actually trying to see.',
  },
  {
    code: 'S6', part: 2, title: 'Lightning Strikes',
    telemetry: ['TOWER LK-019', 'EMI: SEVERE', 'DECODER: CRASH LOOP'],
    story: `Electromagnetic interference is intermittently flipping bits in transit. The video decoder crashes when it tries to parse structurally invalid frames.`,
    a: 'Wrap the stream in TLS so any tampering or corruption invalidates the session and forces a clean renegotiation.',
    b: 'Use a lightweight UDP checksum that silently discards individual corrupted frames.',
    correct: 'b',
    resultOk: 'Correct. You want the smallest possible blast radius per flipped bit.',
    resultNo: 'TLS is not wrong about the corruption — it just responds by killing the session, so you get a permanent renegotiation loop.',
    lesson: 'Error <i>detection</i> and error <i>recovery</i> are different problems. TLS treats corruption as a security event and tears down the connection; a checksum treats it as a data event and drops one frame. Match the mechanism to the failure mode.',
  },
  {
    code: 'S7', part: 2, title: 'The Midnight Snow',
    telemetry: ['TOWER LK-233', 'GAIN: +36 dB', 'BITRATE: 3× NOMINAL'],
    story: `Night vision cranks the sensor ISO, injecting heavy visual noise into every frame. Your compressor — which relies on finding repeating patterns — sees random static as "detail" and triples the output size.`,
    a: 'Switch the encoder from VBR to CBR to hard-cap the outbound bitrate regardless of scene content.',
    b: 'Apply a spatial low-pass filter (blur) to the raw feed before it reaches the encoder, so the compressor sees fewer "unique" pixels.',
    correct: 'b',
    resultOk: 'Correct. Remove the entropy at the source instead of asking the encoder to fight it.',
    resultNo: 'CBR caps the number, not the problem — the encoder still spends every bit describing noise, and now your real detail gets crushed too.',
    lesson: 'Pre-processing beats post-constraining. Capping the output bitrate distorts everything uniformly; cleaning the input lets the encoder do its job well. Fix data quality upstream of the algorithm, not downstream.',
  },
  {
    code: 'S8', part: 2, title: 'The Spreading Glitch',
    telemetry: ['TOWER LK-004', 'GOP: 300', 'ARTEFACT: PERSISTENT'],
    story: `Hail causes intermittent packet loss. A junior dev notices that P-frames (delta updates) are being applied on top of already-corrupted pixels, causing the glitch to persist and smear across subsequent frames. They propose the obvious fix: stop using the mechanism that\u2019s propagating the corruption.`,
    a: 'Disable P-frames entirely. The root cause of the smearing is deltas applied to bad state — remove the deltas, remove the smearing. Directly addresses the diagnosis.',
    b: 'Keep P-frames — the exact mechanism causing the visible problem — and instead send full I-frames more often, spending significantly more bandwidth to periodically overwrite corrupted state.',
    correct: 'b',
    resultOk: 'Correct. Shorten the horizon on state drift rather than abandoning the model.',
    resultNo: 'The diagnosis was right and the fix still isn\u2019t — all-intra cures the smear at roughly eight times the bitrate, on a link that is already losing packets.',
    lesson: 'Deltas aren\u2019t the bug; unbounded delta chains are. Disabling P-frames "solves" the smearing at a catastrophic bandwidth cost — you\u2019d be sending full frames constantly, which on a lossy link means even more packet loss and worse outcomes. The right fix is a shorter horizon on state drift, not eliminating deltas. Same pattern shows up in event sourcing, cache invalidation, and CRDTs: checkpoint more often, don\u2019t abandon the model.',
  },
];

/* ------------------------------------------------------------------ steps */

export const STEPS = [
  {
    type: 'title', section: 'INTRO', cinematic: true,
    html: `
      <div class="slide title">
        <div class="kicker">NORTH ATLANTIC OPERATIONS · NIGHT WATCH · 02:14 UTC</div>
        <h1>The Autonomous<br/>Lighthouse Network</h1>
        <div class="title-rule"></div>
        <p class="lead">Three thousand unmanned towers. One storm. Every engineering trade-off
        you have ever argued about, with actual salt water involved.</p>
        <div class="stat-row">
          <div>Towers online <b>3,412</b></div>
          <div>Live streams <b>3,118</b></div>
          <div>Sea state <b class="am">9 · PHENOMENAL</b></div>
          <div>Open incidents <b class="rd">47</b></div>
        </div>
      </div>`,
  },
  {
    type: 'title', section: 'INTRO', cinematic: true,
    html: `
      <div class="slide title">
        <div class="kicker">WHO YOU ARE TONIGHT</div>
        <h2>You are on call for<br/>3,412 lighthouses.</h2>
        <p class="lead">Nobody lives in them any more. Each one is a sensor platform bolted to a rock:
        cameras, radar, weather instrumentation, an NPU, a battery, and a radio pointed at the mainland.</p>
        <ul class="bullets" style="max-width:64ch;margin-top:18px">
          <li>You <b>ingest live video</b> from every tower for object detection, collision avoidance and weather modelling.</li>
          <li>Models run <b>at the edge and in the cloud</b>, and humans review anything that looks like a hull in the wrong place.</li>
          <li>You own the <b>incidents</b>: failed links, flooded generators, corrupted feeds, and the pager at 02:14.</li>
          <li>Every fix you ship is a trade between <b class="cy">cloud cost</b>, <b class="am">energy</b>, <b class="vi">bandwidth</b> and <b class="rd">how much truth you lose</b>.</li>
        </ul>
      </div>`,
  },
  {
    type: 'title', section: 'INTRO',
    html: `
      <div class="slide">
        <div class="kicker">TONIGHT'S WATCH</div>
        <h2>Two systems, one storm.</h2>
        <div class="agenda">
          <div class="card"><span>PART 01</span><h3>The Pipeline</h3>
            <p>Getting bits off the rock. Edge versus cloud, link budgets, buffers, backoff, transport and the power cost of the radio.</p></div>
          <div class="card"><span>PART 02</span><h3>The Payload</h3>
            <p>What is actually inside the bits. Spatial versus temporal resolution, I-frames and P-frames, checksums and rate control.</p></div>
          <div class="card"><span>FINALE</span><h3>Fix That Stream</h3>
            <p>A live, degrading feed and a full ops console. Highest fidelity under the bandwidth cap wins the room.</p></div>
        </div>
        <p class="muted small mono" style="margin-top:26px">EIGHT SCENARIOS · ONE SCOREBOARD · NO TIMERS — THE PRESENTER DRIVES EVERY BEAT</p>
      </div>`,
  },

  /* ---------------- PART 1 THEORY ---------------- */
  {
    type: 'title', section: 'PART 1 · THE PIPELINE', cinematic: true,
    html: `
      <div class="slide title">
        <div class="kicker">PART ONE</div>
        <h1>The Pipeline</h1>
        <div class="title-rule"></div>
        <p class="lead">Everything that happens between a photon hitting a sensor on a rock in the
        Atlantic and a pixel appearing on a screen in the operations centre.</p>
      </div>`,
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'THE LINK IS THE PRODUCT',
    title: 'Four numbers own your architecture',
    bullets: [
      '<b>Bandwidth</b> — how many bits per second fit. It is a hard ceiling, and storms move it in real time. On a factory network it is the site uplink, and forty inspection cameras fill it just as fast.',
      '<b>Latency</b> — how long a bit takes to arrive. You can always add more; you can almost never take it away. A safety stop budgets it in milliseconds. A nightly report does not care.',
      '<b>Jitter</b> — the variance in that latency. This is what actually breaks playback, not raw delay — and what breaks anything running a fixed control loop.',
      '<b>Loss</b> — the fraction that never shows up. Your only real choice is <i>what</i> you lose, not <i>whether</i>.',
    ],
    figure: figLinkBudget,
    takeaway: 'You cannot optimise all four. Pick the two your consumer actually needs and sacrifice deliberately.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'WHERE THE COMPUTE LIVES',
    title: 'Edge versus cloud is a bandwidth decision',
    bullets: [
      '<b>Cloud</b>: enormous models, easy deployment, central retraining — and you pay uplink for every frame, useful or not.',
      '<b>Edge</b>: a small quantised model on the tower NPU. Weaker, harder to update, and it collapses hours of video into a few kilobytes of events.',
      'The cheapest byte in any distributed system is <b>the one you never transmit</b>.',
      'A camera inspecting product moving past at speed <b>cannot call a cloud API</b> — by the time the answer comes back the item is already boxed. The model runs on hardware bolted to the machine, and the cloud receives defect counts rather than images.',
      'Real designs are hybrid: the edge gates, the cloud adjudicates. Ship the interesting 0.1% at full quality.',
    ],
    figure: figEdgeCloud,
    takeaway: 'Move the decision to the data. Only move data when a decision genuinely needs it.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'BUFFERS',
    title: 'A buffer is latency you spend to buy integrity',
    bullets: [
      'Packets do not arrive on a metronome. A jitter buffer holds them, reorders them, and releases them on a clock.',
      'Deeper buffer → smoother playback, more reordering absorbed, more time to retransmit — and more delay.',
      '<b>Interactive</b> (a call, a remote ROV, anything steering a machine): latency is the product. Keep buffers tiny, accept the gaps. You never buffer a control signal — late is identical to wrong.',
      '<b>One-way observation</b> (a lighthouse feed, metrics into a time-series database): nobody is waiting for a reply. Buffer aggressively — the on-site collector queues to local disk through a WAN outage and backfills afterwards, like any agent with a write-ahead log.',
      'Buffers also hide failure. A long buffer means you learn about a dead link seconds after it died.',
    ],
    figure: figBuffer,
    takeaway: 'Always ask: who is on the other end, and are they replying? That answer sizes the buffer.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'RECONNECTION',
    title: 'Your recovery path is a load generator',
    bullets: [
      'A tight retry loop turns one shared failure into <b>3,412 synchronised clients</b> hitting the same endpoint.',
      'One site switch reboots and every device on it — controllers, sensors, panels — reconnects in the same second. The outage was 30 seconds; the recovery is ten minutes. Same self-inflicted wound as a fleet of pods all restarting into one service.',
      'That is the <b>thundering herd</b>: the outage ends, everyone reconnects at once, and the ingest tier dies again.',
      '<b>Exponential backoff</b> spreads attempts out over time. <b>Jitter</b> spreads them across clients.',
      'Cap the interval, add a circuit breaker, and make the retry budget explicit. Retries are traffic you chose to send.',
    ],
    figure: figBackoff,
    takeaway: 'Backoff without jitter just synchronises the herd more politely. You need both.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'TRANSPORT',
    title: 'Choose what failure looks like',
    bullets: [
      '<b>TCP</b>: ordered and reliable. A lost packet blocks everything behind it while it is retransmitted — head-of-line blocking. Great for a file, terrible for a live feed.',
      '<b>UDP</b>: fire and forget. Losing a datagram costs you one frame region; the stream keeps flowing.',
      'Industrial networks settled this decades ago: live positions and sensor readings ride UDP-style delivery, because a <b>retransmitted position arrives too late to still be a position</b> — you want the next one, not the old one again. Config pushes and file transfers go over TCP. Two transports on one wire, chosen per payload.',
      'Add exactly the reliability you need on top: sequence numbers, checksums, FEC, selective retransmit.',
      '<b>FEC</b> spends redundant bandwidth so the receiver can repair loss without a round trip. Perfect for one-way, high-loss links.',
    ],
    figure: figTransport,
    takeaway: 'Reliability is not free and it is not binary. Buy it per-frame, not per-session.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'FEC · FORWARD ERROR CORRECTION',
    title: 'Pay for the repair before you need it',
    bullets: [
      'The default way to survive packet loss is to <b>ask again</b>. That costs a round trip — 600 ms over satellite, and the frame is stale before it lands.',
      '<b>FEC sends extra packets you did not need.</b> Split the payload into 4 shards, compute 2 parity shards from them (Reed-Solomon, or in the simplest case XOR), ship all 6.',
      'Lose <i>any</i> 2 of the 6 and the receiver <b>reconstructs the missing data from what did arrive</b>. It never asks the sender for anything.',
      'The price: that is <b>50% permanent bandwidth overhead</b>, paid on every packet, on a calm day as well as in a hailstorm.',
      'And it has a cliff. Lose 3 of 6 and you have nothing — you spent the overhead <i>and</i> lost the frame.',
      '<b>Use it when</b> the link is one-way, the round trip is long, or loss is steady and bounded — which is why long-range wireless sensor radios do it for you, spending coding overhead so a reading survives the electrical noise near heavy motors without ever asking for a resend. <b>Skip it when</b> the link is clean and bandwidth is the binding constraint.',
    ],
    figure: figFEC,
    takeaway: 'FEC converts spare bandwidth into time. If you have bandwidth to spare and no time to spare, buy it.',
  },
  {
    type: 'slide', section: 'PART 1 · THE PIPELINE',
    kicker: 'ENERGY',
    title: 'The radio is the thing that kills the battery',
    bullets: [
      'On a solar-and-battery tower, the <b>transmit amplifier dominates the power budget</b> — typically by an order of magnitude.',
      'Compute is comparatively cheap: an NPU inference costs far less energy than uplinking the frame it looked at.',
      'A battery-powered vibration sensor on a pump runs the maths on-device and sends <b>a dozen numbers, not the waveform</b>. Its multi-year battery life exists because of that, not despite it.',
      'That flips the intuition. <b>Spending compute to avoid I/O is almost always the right trade</b> when you are off-grid.',
      'Fewer frames, smaller frames, batched bursts and a lower duty cycle all buy hours of endurance.',
    ],
    figure: figEnergy,
    takeaway: 'Energy, bandwidth and cost are the same axis wearing different units. Airtime is the enemy.',
  },

  /* ---------------- PART 1 SCENARIOS ---------------- */
  ...SCENARIOS.filter(s => s.part === 1).map(s => ({ type: 'scenario', section: 'PART 1 · INCIDENTS', scenario: s })),
  {
    type: 'debrief', section: 'PART 1 · INCIDENTS',
    html: `
      <div class="slide">
        <div class="kicker amber">WATCH DEBRIEF · PIPELINE</div>
        <h2>Four incidents down.</h2>
        <div id="tally" class="tally"></div>
        <ul class="bullets" style="max-width:70ch">
          <li><b>Backoff with jitter</b> — locally optimal, globally catastrophic.</li>
          <li><b>Buffer deeply on one-way feeds</b> — latency nobody is waiting on is free.</li>
          <li><b>Put compute where the constraint is</b> — the better model loses if it needs the bytes.</li>
          <li><b>Airtime drains the battery</b> — optimise the transmitter, not what looks expensive.</li>
        </ul>
        <div class="takeaway"><b>NEXT</b>The bits are moving. Now let us look at what is inside them.</div>
      </div>`,
  },

  /* ---------------- PART 2 THEORY ---------------- */
  {
    type: 'title', section: 'PART 2 · THE PAYLOAD', cinematic: true,
    html: `
      <div class="slide title">
        <div class="kicker">PART TWO</div>
        <h1>The Payload</h1>
        <div class="title-rule"></div>
        <p class="lead">The pipe is fixed. Now you decide what to put in it — and what you are
        willing to throw away to make it fit.</p>
      </div>`,
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'RESOLUTION',
    title: 'Spatial and temporal are two different budgets',
    bullets: [
      '<b>Spatial resolution</b> — detail inside one frame. It answers "what is that?" and "how wide is that crack?".',
      '<b>Temporal resolution</b> — frames per second. It answers "how fast?", "in which direction?", "did it change?".',
      'At a fixed bitrate these trade directly against one another. 1080p@1fps and 144p@30fps can cost identical bits.',
      'The right split is defined entirely by the consumer: a structural survey wants pixels, a collision detector wants frames. Machine vision forces the choice out loud — shrink the region you look at and the camera runs faster. Checking a seal is closed wants detail; catching the moment a fast-moving sheet tears wants frame rate.',
      'Do not oversample either axis. Sending 4K to a model that infers at 640×640 is pure waste.',
    ],
    figure: figSpatialTemporal,
    takeaway: 'Bitrate is a budget. Detail and motion are the two things you can buy with it.',
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'CODEC ANATOMY',
    title: 'I-frames are truth, P-frames are gossip',
    bullets: [
      '<b>I-frame (keyframe)</b> — a complete, self-contained image. Expensive, decodable on its own.',
      '<b>P-frame</b> — only the difference from the previous frame. Often 10–20× smaller, and useless without its ancestors.',
      'The <b>GOP</b> (group of pictures) is how many frames pass between keyframes. It is the single biggest bitrate lever you have.',
      'Long GOP = tiny stream, slow channel-join, fragile under loss. Short GOP = fat stream, instant recovery.',
      'This is not a video idea. It is snapshots versus event logs, full sync versus deltas. Factory pub/sub does it literally: a device publishes its <b>complete state on connect</b>, then only what changed — and the spec has a "rebirth" command meaning <i>forget the deltas, send me everything again</i>. That is an on-demand keyframe wearing a different name.',
    ],
    figure: figGop,
    takeaway: 'Every delta-encoded system needs a periodic, affordable path back to ground truth.',
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'FAILURE PROPAGATION',
    title: 'Corruption in a delta chain does not stay put',
    bullets: [
      'Damage one P-frame and every frame after it inherits the damage — and the motion vectors <b>drag it across the picture</b>.',
      'That is the smear you have seen on a bad broadcast: an error being faithfully propagated by a working decoder.',
      'You cannot repair it from inside the chain. You have to <b>replace the state</b>, not patch it.',
      'Options: shorten the GOP, request an on-demand keyframe, or add FEC so the damage never lands.',
      'Same pattern as a corrupted replication log or a broken CRDT merge — resync beats reconciliation. Miss one event on a feed that only publishes <i>changes</i> and every dashboard downstream is quietly wrong until something restarts. No pixels, identical mechanism — and worse, because nothing looks broken.',
    ],
    figure: figSmear,
    takeaway: 'When state is derived from deltas, budget for a periodic full-state refresh before you need it.',
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'INTEGRITY',
    title: 'Checksums decide the blast radius',
    bullets: [
      'A checksum does not fix anything. It tells you something is wrong and <b>defines what you throw away</b>.',
      '<b>Per-datagram checksum</b>: one bad packet dies, the stream continues. Blast radius = one frame region.',
      '<b>Session-level integrity (TLS/MAC)</b>: a flipped bit fails authentication and the session tears down. Blast radius = everything.',
      'Under sustained EMI, strong session integrity turns into a permanent reconnect loop — correct, and useless. Match the blast radius to what the data is for: a record of which raw materials went into which batch is audit evidence, so it should be all-or-nothing and authenticated — a silently corrupted one is worse than a missing one. A temperature reading is fine to drop; there is another one in a second.',
      '<b>FEC</b> is the middle path: pay redundancy up front, repair without a round trip, no session teardown.',
    ],
    figure: figChecksum,
    takeaway: 'Integrity is not a switch you turn on. It is a choice about how much dies when something goes wrong.',
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'RATE CONTROL · VBR vs CBR',
    title: 'Pick which variable you let float',
    bullets: [
      'An encoder cannot hold quality <i>and</i> bitrate constant — a calm grey sea and a hailstorm are not the same amount of information. One of the two has to move.',
      '<b>VBR (variable bitrate)</b> — you set a <i>quality</i> target. Quiet scene: 400 kbps. Hail and spray: 6 Mbps, because every pixel is changing. Quality stays even; the bitrate does whatever it takes.',
      '<b>CBR (constant bitrate)</b> — you set a <i>bitrate</i> target. The encoder must fit the hailstorm into the same 800 kbps as the calm sea, so it throws away detail until it fits. Bitrate stays flat; quality is what moves.',
      'VBR is what you want for storage and adaptive streaming — you are not paying for bits you did not need.',
      'CBR is what you want on a <b>fixed, unshared, capacity-planned link</b>: it can never spike through the ceiling and take the tower offline. It is also why site camera feeds are hard-capped — one network carries both video and machine traffic, and a busy scene on camera 12 must never compete with it. You cap it, and accept that it looks worst exactly when the most is happening.',
      'The trap: CBR does not make a noisy scene cheap. It makes it <b>ugly</b> — uniformly, across the whole frame, including the crack you were trying to inspect.',
    ],
    figure: figRate,
    takeaway: 'VBR guarantees how it looks. CBR guarantees what it costs. You only get to guarantee one.',
  },
  {
    type: 'slide', section: 'PART 2 · THE PAYLOAD',
    kicker: 'PRE-PROCESSING',
    title: 'Noise is incompressible. Remove it first.',
    bullets: [
      'Compression works by <b>predicting</b> — this block looks like that block, this frame looks like the last one. Anything unpredictable has to be sent literally.',
      'Sensor noise (high-ISO grain, rain, snow, night-vision gain) is <b>random by definition</b>, so it is unpredictable in every macroblock, in every frame.',
      'The encoder cannot tell noise from detail. It faithfully spends real bits encoding static, and the file triples.',
      'A cheap <b>denoise or low-pass pre-filter</b> deletes that entropy before the encoder ever sees it — often halving bitrate with almost no loss of the signal you care about. The metrics version is the same trick: a noisy analogue signal stored at full precision compresses terribly and fills the archive with meaningless wobble, so you configure the sensor to report only when the value moves by more than <i>x</i>. That is the difference between keeping a week of history and keeping a year.',
      'Note the difference: <b>CBR post-constrains</b> the damage (cap the output, degrade everything). <b>Pre-filtering removes the cause</b> (clean the input, let the encoder do its job well).',
      'Same lesson as normalising input before it hits an expensive downstream stage: clean first, compute second.',
    ],
    figure: figDenoise,
    takeaway: 'Never make an expensive algorithm fight a problem a cheap pre-processing step could have deleted.',
  },

  /* ---------------- PART 2 SCENARIOS ---------------- */
  ...SCENARIOS.filter(s => s.part === 2).map(s => ({ type: 'scenario', section: 'PART 2 · INCIDENTS', scenario: s })),
  {
    type: 'debrief', section: 'PART 2 · INCIDENTS',
    html: `
      <div class="slide">
        <div class="kicker amber">WATCH DEBRIEF · PAYLOAD</div>
        <h2>Eight incidents. Final scoreboard.</h2>
        <div id="tally" class="tally"></div>
        <div id="tally-line" class="mono muted" style="margin-bottom:22px"></div>
        <ul class="bullets" style="max-width:70ch">
          <li><b>Spatial vs temporal</b> — spend the bitrate on the axis carrying the answer.</li>
          <li><b>Match mechanism to failure mode</b> — a checksum drops a frame, TLS drops the session.</li>
          <li><b>Pre-process, do not post-constrain</b> — fix data quality upstream of the algorithm.</li>
          <li><b>Checkpoint, do not abandon deltas</b> — bound the drift, keep the model.</li>
        </ul>
        <div class="takeaway"><b>NOW</b>Stop answering questions about the storm. Go and fly through one.</div>
      </div>`,
  },
  {
    type: 'board', board: 'quiz', section: 'PART 2 · INCIDENTS',
  },

  /* ---------------- GAME ---------------- */
  {
    type: 'title', section: 'FINALE · FIX THAT STREAM',
    html: `
      <div class="slide">
        <div class="kicker amber">FINALE</div>
        <h2>Fix That Stream</h2>
        <p class="lead">One tower. One degrading link. Every lever from the last forty minutes,
        on one console — and a storm that will not sit still.</p>
        <div class="grid" style="margin-top:24px">
          <ul class="bullets">
            <li><b>Left:</b> the stream as the operations centre receives it. <b>Right:</b> the pristine feed as the sensor sees it.</li>
            <li><b>Wind</b> costs you link capacity and drops frames. <b>Hail</b> corrupts blocks — and P-frames will smear that damage forward.</li>
            <li>Both fluctuate continuously. There is no time limit and no timer: this runs until the presenter ends it.</li>
          </ul>
          <ul class="bullets">
            <li><b class="rd">Hard rule:</b> bandwidth may never exceed 100% of capacity. Go over and the link sheds packets.</li>
            <li><b class="cy">Your score is FIDELITY</b> — a real pixel comparison against the sensor feed, scored on accuracy, detail, motion and responsiveness. Blur, drops, corruption and stale pictures all cost you.</li>
            <li>Highest average fidelity in the room wins. Presenter ends the round with <span class="mono">ENTER</span>.</li>
          </ul>
        </div>
      </div>`,
  },
  { type: 'game', section: 'FINALE · FIX THAT STREAM' },
];

export const SCENARIO_COUNT = SCENARIOS.length;
