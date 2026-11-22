// Pure game state (no DOM). Emits 'change' events.
import { isBlockingType } from '../model/objects.js';

const key = (r, c) => `${r},${c}`;

export class GameState extends EventTarget {
  constructor(puzzle) {
    super();
    this.puzzle = puzzle;
    this.placements = {};
    this.notes = {};          // 'r,c' -> Set of ids
    this.marks = new Set();   // 'r,c'
    this.selected = null;
    this.tool = 'note';
    this.elapsed = 0;         // seconds
    this.solved = false;
    this._undo = [];
    this._paintMode = null;   // 'add' | 'remove'
    this._paintStamp = 0;
  }

  _emit() { this.dispatchEvent(new Event('change')); }

  // ---- snapshots -------------------------------------------------------
  _snap() {
    return JSON.stringify({
      p: this.placements,
      n: Object.fromEntries(Object.entries(this.notes).map(([k, s]) => [k, [...s]])),
      m: [...this.marks],
    });
  }
  _applySnap(s) {
    const o = JSON.parse(s);
    this.placements = o.p || {};
    this.notes = {};
    for (const [k, a] of Object.entries(o.n || {})) if (a.length) this.notes[k] = new Set(a);
    this.marks = new Set(o.m || []);
  }
  _push() {
    this._undo.push(this._snap());
    if (this._undo.length > 200) this._undo.shift();
  }
  get canUndo() { return this._undo.length > 0; }

  undo() {
    if (!this._undo.length) return false;
    this._applySnap(this._undo.pop());
    this._emit();
    return true;
  }

  // ---- selection / tool ------------------------------------------------
  select(id) {
    if (id != null && !this.puzzle.characters.some(c => c.id === id)) id = null;
    if (this.selected === id) return;
    this.selected = id;
    this._emit();
  }
  setTool(t) {
    if (!['note', 'x', 'erase'].includes(t) || this.tool === t) return;
    this.tool = t;
    this._emit();
  }

  // ---- notes -----------------------------------------------------------
  _hasNote(r, c, id) { return !!this.notes[key(r, c)]?.has(id); }
  _setNote(r, c, id, on) {
    const k = key(r, c);
    if (on) (this.notes[k] ||= new Set()).add(id);
    else if (this.notes[k]) { this.notes[k].delete(id); if (!this.notes[k].size) delete this.notes[k]; }
  }

  toggleNote(r, c, id = this.selected) {
    if (id == null || this.isBlocked(r, c)) return false;
    this._push();
    this._setNote(r, c, id, !this._hasNote(r, c, id));
    this._paintMode = null;
    this._emit();
    return true;
  }

  // Drag painting: first call after a toggleNote/begin decides mode. Returns the applied mode or null.
  paintNote(r, c, id = this.selected, on) {
    if (id == null || this.isBlocked(r, c)) return null;
    if (on === undefined) {
      if (!this._paintMode) this._paintMode = this._hasNote(r, c, id) ? 'remove' : 'add';
      on = this._paintMode === 'add';
    }
    if (this._hasNote(r, c, id) === on) return on;
    this._setNote(r, c, id, on);
    this._emit();
    return on;
  }
  // Snapshot for undo (call once at the start of a paint gesture).
  checkpoint() { this._push(); }
  endPaint() { this._paintMode = null; }

  // ---- marks -----------------------------------------------------------
  toggleMark(r, c) {
    if (this.isBlocked(r, c)) return false;
    this._push();
    const k = key(r, c);
    if (this.marks.has(k)) this.marks.delete(k); else this.marks.add(k);
    this._emit();
  }
  paintMark(r, c, on) {
    const k = key(r, c);
    if (this.isBlocked(r, c) || this.marks.has(k) === on) return;
    this.marks[on ? 'add' : 'delete'](k);
    this._emit();
  }
  // Notes/marks are never kept on cells blocked by furniture (crates, shelves, tables...).
  _dropBlocked() {
    for (const k of Object.keys(this.notes)) { const [r, c] = k.split(',').map(Number); if (this.isBlocked(r, c)) delete this.notes[k]; }
    for (const k of [...this.marks]) { const [r, c] = k.split(',').map(Number); if (this.isBlocked(r, c)) this.marks.delete(k); }
  }
  hasMark(r, c) { return this.marks.has(key(r, c)); }

  // ---- placement -------------------------------------------------------
  isBlocked(r, c) {
    const o = (this.puzzle.objects || []).find(o => o.r === r && o.c === c);
    return !!o && isBlockingType(o.type);
  }
  charAt(r, c) {
    for (const [id, p] of Object.entries(this.placements)) if (p.r === r && p.c === c) return id;
    return null;
  }

  // Another placed character already using row r or column c (one per row/column rule).
  conflictAt(id, r, c) {
    for (const [other, p] of Object.entries(this.placements)) {
      if (other !== id && (p.r === r || p.c === c)) return other;
    }
    return null;
  }

  place(id, r, c) {
    if (this.isBlocked(r, c)) return false;
    if (this.conflictAt(id, r, c)) return false;
    this._push();
    this.placements[id] = { r, c };
    // Clean up notes: this character's notes anywhere, and every note in its row and column.
    for (const k of Object.keys(this.notes)) {
      const [nr, nc] = k.split(',').map(Number);
      if (nr === r || nc === c) delete this.notes[k];
      else this._setNote(nr, nc, id, false);
    }
    this._emit();
    return true;
  }
  unplace(id) {
    if (!this.placements[id]) return false;
    this._push();
    delete this.placements[id];
    this._emit();
    return true;
  }

  eraseCell(r, c) {
    const k = key(r, c);
    const id = this.charAt(r, c);
    if (!id && !this.notes[k] && !this.marks.has(k)) return false;
    this._push();
    if (id) delete this.placements[id];
    delete this.notes[k];
    this.marks.delete(k);
    this._emit();
    return true;
  }

  clearAll() {
    if (!Object.keys(this.placements).length && !Object.keys(this.notes).length && !this.marks.size) return;
    this._push();
    this.placements = {};
    this.notes = {};
    this.marks = new Set();
    this._emit();
  }

  // ---- derived ---------------------------------------------------------
  autoMarks() {
    const n = this.puzzle.size;
    const rows = new Set(), cols = new Set(), taken = new Set();
    for (const p of Object.values(this.placements)) { rows.add(p.r); cols.add(p.c); taken.add(key(p.r, p.c)); }
    const out = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if ((rows.has(r) || cols.has(c)) && !taken.has(key(r, c)) && !this.isBlocked(r, c)) out.push(key(r, c));
    }
    return out;
  }

  allPlaced() {
    return this.puzzle.characters.every(ch => this.placements[ch.id]);
  }

  toView(hover = null) {
    const notes = {};
    for (const [k, s] of Object.entries(this.notes)) if (s.size) notes[k] = [...s];
    const placements = {};
    for (const [id, p] of Object.entries(this.placements)) placements[id] = { r: p.r, c: p.c };
    return {
      placements,
      notes,
      marks: [...this.marks],
      autoMarks: this.autoMarks(),
      selected: this.selected,
      hover: hover || null,
    };
  }

  // ---- persistence -----------------------------------------------------
  serialize() {
    return {
      placements: this.placements,
      notes: Object.fromEntries(Object.entries(this.notes).map(([k, s]) => [k, [...s]])),
      marks: [...this.marks],
      elapsed: Math.round(this.elapsed),
      solved: this.solved,
    };
  }
  restore(data) {
    if (!data || typeof data !== 'object') return;
    const ids = new Set(this.puzzle.characters.map(c => c.id));
    this.placements = {};
    for (const [id, p] of Object.entries(data.placements || {})) {
      if (ids.has(id) && p && Number.isInteger(p.r) && Number.isInteger(p.c)) this.placements[id] = { r: p.r, c: p.c };
    }
    this.notes = {};
    for (const [k, a] of Object.entries(data.notes || {})) {
      const f = (a || []).filter(i => ids.has(i));
      if (f.length) this.notes[k] = new Set(f);
    }
    this.marks = new Set(data.marks || []);
    this._dropBlocked();
    this.elapsed = +data.elapsed || 0;
    this.solved = !!data.solved;
    this._undo = [];
    this._emit();
  }
}
