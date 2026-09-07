/**
 * Shared leaderboard rendering, used by both the incident board (x/8) and the
 * finale board (fidelity %).
 *
 * The interesting rule is the masking: before the presenter reveals, every row
 * shows its rank and its score but hides who earned it — except your own row,
 * which is always legible. That way the room can see the shape of the result
 * (how close it was, whether anyone cracked 90) and each person can find
 * themselves in it, while the reveal still has something left to give.
 */

import { BOARD_TOP_N } from './config.js';

const escapeHTML = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A mask that preserves name length, so the reveal still feels like a reveal. */
function mask(name) {
  const n = Math.max(3, Math.min(12, String(name || '').trim().length || 6));
  return '▓'.repeat(n);
}

/**
 * @param {Array<{name:string,score:number,mine?:boolean}>} rows
 * @param {{revealed?:boolean, fmt?:(n:number)=>string, tag?:(r:any)=>string,
 *          title?:string, empty?:string, topN?:number, waiting?:number}} opts
 */
export function boardHTML(rows, opts = {}) {
  const {
    revealed = false,
    fmt = n => n.toFixed(1) + '%',
    tag = () => '',
    title = 'LEADERBOARD',
    empty = 'No scores in yet.',
    topN = BOARD_TOP_N,
    waiting = 0,
  } = opts;

  if (!rows.length) {
    return `<div class="board">
      <div class="board-title">${escapeHTML(title)}</div>
      <div class="board-empty">${escapeHTML(empty)}${
        waiting ? ` <b>${waiting}</b> connected.` : ''}</div>
    </div>`;
  }

  const ranked = [...rows].sort((a, b) => b.score - a.score || (a.at || 0) - (b.at || 0));
  const mineIdx = ranked.findIndex(r => r.mine);
  const shown = ranked.slice(0, topN);
  // Never let someone fall off the bottom of their own leaderboard.
  if (mineIdx >= topN) shown.push(ranked[mineIdx]);

  const rowHTML = (r, i) => {
    const rank = ranked.indexOf(r) + 1;
    const named = revealed || r.mine;
    const who = named ? escapeHTML(r.name || 'ANON') : mask(r.name);
    const t = tag(r);
    return `<li class="${r.mine ? 'mine' : ''}${rank === 1 ? ' crown' : ''}${
      named ? '' : ' hush'}${mineIdx >= topN && i === shown.length - 1 ? ' split' : ''}">
      <span class="rank">${rank}</span>
      <span class="who">${who}${r.mine ? '<em>YOU</em>' : ''}</span>
      <span class="pts">${fmt(r.score)}</span>
      ${t ? `<span class="tag2">${escapeHTML(t)}</span>` : ''}
    </li>`;
  };

  const hidden = ranked.length - shown.length;
  return `<div class="board${revealed ? ' revealed' : ''}">
    <div class="board-title">${escapeHTML(title)}
      <span class="board-n">${ranked.length} PLAYER${ranked.length > 1 ? 'S' : ''}</span></div>
    <ol class="board-list">${shown.map(rowHTML).join('')}</ol>
    ${hidden > 0 ? `<div class="board-empty">…and ${hidden} more.</div>` : ''}
    ${revealed ? '' : '<div class="board-hush">NAMES SEALED · PRESENTER PRESSES <b>L</b> TO REVEAL</div>'}
  </div>`;
}

export const quizGrade = n =>
  n >= 7 ? 'HARBOUR MASTER'
    : n >= 5 ? 'WATCH OFFICER'
      : n >= 3 ? 'JUNIOR ENGINEER'
        : 'TRAINEE';
