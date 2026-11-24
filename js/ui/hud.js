// DOM/HUD layer. No game logic: emits actions through a callback.
import { cellName } from "../model/grid.js";
import { objectInfo } from "../model/objects.js";
import { weaponInfo } from "../model/weapons.js";

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// Escape then convert **bold** -> <b>
export function richText(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
const DIFF_LABEL = { 'very-easy': 'Very easy', easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const $ = (id) => document.getElementById(id);

export class Hud {
  /** @param {(action:string, payload?:any)=>void} onAction */
  constructor(onAction) {
    this.onAction = onAction;
    this.canvasEl = $('canvas');
    this.cards = new Map();
    this._holdRaf = 0;

    // generic buttons
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (t && !t.disabled) { onAction(t.dataset.action); return; }
      const cl = e.target.closest('[data-close]');
      if (cl) this.closeModals();
      if (e.target.classList?.contains('modal') && e.target.id !== 'modal-win') this.closeModals();
    });
    document.querySelectorAll('.tool[data-tool]').forEach(btn => {
      if (btn.id === 'btn-erase') return;
      btn.addEventListener('click', () => onAction('tool', btn.dataset.tool));
    });
    this._wireEraser($('btn-erase'));
    $('btn-objects')?.addEventListener('click', () => this.openModal('modal-objects'));
  }

  _wireEraser(btn) {
    const fill = btn.querySelector('.fill');
    const HOLD = 600;
    let start = 0, fired = false, active = false;
    const stop = () => { cancelAnimationFrame(this._holdRaf); fill.style.height = '0'; active = false; };
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / HOLD);
      fill.style.height = `${p * 100}%`;
      if (p >= 1) { fired = true; stop(); this.onAction('clearall'); return; }
      this._holdRaf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      fired = false; active = true; start = performance.now();
      this._holdRaf = requestAnimationFrame(tick);
    });
    const up = () => { if (!active) return; const wasFired = fired; stop(); if (!wasFired) this.onAction('tool', 'erase'); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', () => { if (active) stop(); });
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onAction('tool', 'erase'); } });
  }

  // ---------- screens ----------
  showScreen(name) {
    $('screen-menu').hidden = name !== 'menu';
    $('screen-game').hidden = name !== 'game';
    window.scrollTo(0, 0);
  }

  // ---------- menu ----------
  renderMenu(cases, solvedIds, onPlay) {
    const list = $('case-list');
    list.innerHTML = '';
    cases.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'case-card';
      const solved = solvedIds.has(p.id);
      b.innerHTML = `${solved ? '<span class="done" title="Solved">&#10003;</span>' : ''}
        <span class="ct">${esc(p.title || 'Case ' + (i + 1))}</span>
        <span class="row"><span class="chip d-${esc(p.difficulty || 'easy')}">${esc(DIFF_LABEL[p.difficulty] || p.difficulty || '')}</span>
        <span class="chip">${p.size}&times;${p.size}</span>
        <span class="chip">${(p.characters || []).length} people</span></span>`;
      b.addEventListener('click', () => onPlay(i));
      list.appendChild(b);
    });
    if (!cases.length) list.innerHTML = '<p class="msg" style="color:var(--ink-soft)">No case files yet. Try a random case below!</p>';
  }
  getRandomOptions() {
    const difficulty = $('rnd-diff').value;
    return { size: difficulty === 'extreme' ? 16 : +$('rnd-size').value, difficulty };
  }
  // Keep the size/difficulty selects consistent: Extreme <-> 16x16 (other combos are all valid).
  bindRandomSync() {
    const size = $('rnd-size'), diff = $('rnd-diff');
    if (!size || !diff) return;
    diff.addEventListener('change', () => { if (diff.value === 'extreme') size.value = '16'; });
    size.addEventListener('change', () => {
      if (diff.value === 'extreme' && +size.value !== 16) diff.value = 'hard';
    });
  }
  setRandomBusy(busy) {
    const b = $('rnd-go');
    b.disabled = busy;
    b.querySelector('.spinner').hidden = !busy;
    b.querySelector('.lbl').textContent = busy ? 'Investigating...' : 'Generate case';
  }
  setRandomMessage(msg) {
    const m = $('rnd-msg');
    m.hidden = !msg;
    m.textContent = msg || '';
  }

  // Legend of object types present in the puzzle (label, desc, can-stand tag).
  buildObjectsLegend(puzzle) {
    const ul = $('objects-list');
    if (!ul) return;
    const types = [...new Set((puzzle.objects || []).map(o => o.type))].map(objectInfo);
    types.sort((a, b) => (a.blocking - b.blocking) || a.label.localeCompare(b.label));
    ul.innerHTML = types.map(i => `<li><span class="ol-name">${esc(i.label)}</span><span class="ol-desc">${esc(i.desc)}</span><span class="ol-tag ${i.blocking ? 'no' : 'ok'}">${i.blocking ? 'Blocked' : 'Can stand here'}</span></li>`).join('');
  }

  // ---------- game ----------
  buildGame(puzzle, { portrait, clueText, noteText }) {
    this.buildObjectsLegend(puzzle);
    $('case-title').textContent = puzzle.title || 'Case';
    const meta = $('case-meta');
    meta.textContent = `${puzzle.size}×${puzzle.size}`;
    meta.className = `chip d-${puzzle.difficulty || 'easy'}`;
    this.setTimer(0);
    const notes = Array.isArray(puzzle.notes) ? puzzle.notes : [];
    const notesBox = $('notes'), notesList = $('notes-list');
    if (notesBox && notesList) {
      notesList.innerHTML = notes.map(n => {
        let t;
        try { t = noteText ? noteText(n, puzzle) : (n && n.type ? String(n.type) : 'Note'); } catch { t = (n && n.type) || 'Note'; }
        return `<li>${richText(t)}</li>`;
      }).join('');
      notesBox.hidden = notes.length === 0;
    }
    const box = $('suspects');
    box.innerHTML = '';
    this.cards.clear();
    puzzle.characters.forEach((ch, idx) => {
      const el = document.createElement('div');
      el.className = 'card' + (ch.victim ? ' victim' : '');
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.dataset.id = ch.id;
      let src = '';
      try { src = portrait(ch); } catch { /* ignore */ }
      const clues = (ch.clues || []).map(c => {
        let t = '';
        try { t = clueText(c, ch, puzzle); } catch { t = '...'; }
        return `<li>${richText(t)}</li>`;
      }).join('');
      const wi = weaponInfo(ch.weapon);
      const weapon = wi ? `<span class="weapon" title="Carries: ${esc(wi.label)}">${wi.emoji} ${esc(wi.label)}</span>` : '';
      el.innerHTML = `<img alt="" ${src ? `src="${src}"` : ''}>
        <div><div class="nm"><span class="letter">${esc(ch.id)}</span>${esc(ch.name)}${weapon}<span class="placed"></span></div><ul class="clues">${clues}</ul></div>`;
      el.title = `${ch.name} (${idx + 1})`;
      const pick = () => this.onAction('select', ch.id);
      el.addEventListener('click', pick);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      box.appendChild(el);
      this.cards.set(ch.id, el);
    });
  }

  refresh(state) {
    const p = state.puzzle;
    for (const [id, el] of this.cards) {
      el.classList.toggle('selected', state.selected === id);
      const pl = state.placements[id];
      el.querySelector('.placed').textContent = pl ? `✓ ${cellName(pl.r, pl.c)}` : '';
    }
    document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === state.tool));
    $('btn-undo').disabled = !state.canUndo;
    $('btn-submit').disabled = !state.allPlaced() || state.solved;
    const sel = state.selected && p.characters.find(c => c.id === state.selected);
    $('selected-hint').textContent = sel ? `${sel.name} selected: tap = note, hold = place` : '';
    const selEl = state.selected && this.cards.get(state.selected);
    if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  setTimer(s) { $('timer').textContent = fmtTime(s); }

  setMuted(m) {
    document.querySelectorAll('.mute-ico').forEach(e => { e.innerHTML = m ? '&#128263;' : '&#128266;'; });
    document.querySelectorAll('.mute-label').forEach(e => { e.textContent = m ? 'Muted' : (e.closest('.tool') ? 'Sound' : 'Sound on'); });
  }

  setMood(m) {
    const [ico, label] = { golden: ['&#127749;', 'Sunset'], night: ['&#127769;', 'Night'] }[m] || ['&#9728;&#65039;', 'Day'];
    document.querySelectorAll('.mood-ico').forEach(e => { e.innerHTML = ico; });
    document.querySelectorAll('.mood-label').forEach(e => { e.textContent = label; });
  }

  showCanvasError(msg) {
    this.canvasEl.innerHTML = `<div class="webgl-error"><div>${esc(msg)}</div></div>`;
  }

  // ---------- toasts / modals ----------
  toast(msg, { kind = '', ms = 3500, html = false } = {}) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    if (html) t.innerHTML = msg; else t.innerHTML = richText(msg);
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, ms);
  }
  openModal(id) { $(id).hidden = false; }
  closeModals() { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }
  anyModalOpen() { return [...document.querySelectorAll('.modal')].some(m => !m.hidden); }
  showHelp() { this.openModal('modal-help'); }
  showError(title, text) {
    $('error-title').textContent = title;
    $('error-text').textContent = text;
    this.openModal('modal-error');
  }
  showWin({ name, portraitSrc, time, hasNext }) {
    $('win-name').textContent = name;
    $('win-portrait').src = portraitSrc || '';
    $('win-time').textContent = fmtTime(time);
    document.querySelector('[data-action="winnext"]').hidden = !hasNext;
    this.openModal('modal-win');
  }
}
