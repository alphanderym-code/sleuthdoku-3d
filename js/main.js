import { SAMPLE_PUZZLE } from './puzzles/sample.js';
import { GameState } from './game/state.js';
import { Hud, fmtTime } from './ui/hud.js';

// ---------- optional / sibling modules (dynamic so failures degrade gracefully) ----------
const noop = () => {};
let sfx = new Proxy({ muted: false, setMuted: noop }, { get: (t, k) => (k in t ? t[k] : noop) });
let BoardViewClass = null;
let clueTextFn = (c) => c.type;
let noteTextFn = null;
let solver = {};
let getHint = null;
let generatePuzzle = null;
let CASES = [SAMPLE_PUZZLE];

async function tryImport(path) {
  try { return await import(path); } catch (e) { console.warn('[tinycrimes] could not load', path, e); return null; }
}
const modsReady = (async () => {
  const [s, sc, cl, so, hi, ge, ca] = await Promise.all([
    tryImport('./audio/sfx.js'), tryImport('./render/scene.js'), tryImport('./model/clues.js'),
    tryImport('./model/solver.js'), tryImport('./model/hints.js'), tryImport('./model/generator.js'),
    tryImport('./puzzles/cases.js'),
  ]);
  if (s?.sfx) sfx = s.sfx;
  BoardViewClass = sc?.BoardView || null;
  if (cl?.clueText) clueTextFn = cl.clueText;
  if (cl?.noteText) noteTextFn = cl.noteText;
  solver = so || {};
  getHint = hi?.getHint || null;
  generatePuzzle = ge?.generatePuzzle || null;
  if (Array.isArray(ca?.CASES) && ca.CASES.length) CASES = ca.CASES;
})();

// ---------- storage ----------
const K_SOLVED = 'sleuthdoku:solved';
const K_PROG = (id) => `sleuthdoku:progress:${id}`;
const K_MUTE = 'sleuthdoku:muted';
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function solvedSet() { try { return new Set(JSON.parse(lsGet(K_SOLVED) || '[]')); } catch { return new Set(); } }
function markSolved(id) { const s = solvedSet(); s.add(id); lsSet(K_SOLVED, JSON.stringify([...s])); }

// ---------- app state ----------
let hud;
let board = null;
let state = null;
// Debug handle for the browser console (read-only use recommended).
if (new URLSearchParams(location.search).has('debug')) {
  window.__sleuth = { get state() { return state; }, get board() { return board; } };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
let puzzle = null;
let source = null;       // { kind:'case', index } | { kind:'random', opts }
let hover = null;
let timerHandle = 0;
let lastTick = 0;
let saveTimer = 0;
let paintActive = false;
let markPaintMode = null;
let winTimeout = 0;

function init() {
  hud = new Hud(onAction);
  hud.bindRandomSync();
  const muted = lsGet(K_MUTE) === '1';
  sfx.setMuted(muted);
  hud.setMuted(muted);
  window.addEventListener('pointerup', endGesture);
  window.addEventListener('pointercancel', endGesture);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
  modsReady.then(() => { sfx.setMuted(muted); hud.setMuted(muted); if (!state) showMenu(); });
  showMenu();
}

function endGesture() {
  paintActive = false; markPaintMode = null;
  state?.endPaint();
}

// ---------- menu ----------
function showMenu() {
  stopGame();
  hud.showScreen('menu');
  hud.renderMenu(CASES, solvedSet(), (i) => { sfx.click(); startCase(i); });
}

function startCase(i) {
  source = { kind: 'case', index: i };
  loadPuzzle(CASES[i]);
}

function generateRandom() {
  const opts = hud.getRandomOptions();
  hud.setRandomMessage('');
  hud.setRandomBusy(true);
  setTimeout(() => {
    try {
      if (!generatePuzzle) throw new Error('The case generator is not available yet.');
      const p = generatePuzzle({ ...opts, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
      if (!p) throw new Error('No case came out. Try again!');
      source = { kind: 'random', opts };
      hud.setRandomBusy(false);
      loadPuzzle(p);
    } catch (e) {
      console.error(e);
      hud.setRandomBusy(false);
      hud.setRandomMessage(`Couldn't generate that case (${e.message || e}). Try another size or difficulty.`);
    }
  }, 40);
}

// ---------- game ----------
function stopGame() {
  clearInterval(timerHandle); timerHandle = 0;
  clearTimeout(winTimeout);
  if (state) saveNow();
  if (board) { try { board.dispose(); } catch { /* ignore */ } board = null; }
  hud?.canvasEl && (hud.canvasEl.innerHTML = '');
  state = null; puzzle = null;
}

function loadPuzzle(p) {
  stopGame();
  hud.closeModals();
  try { if (!p.solution && !p.murderer && solver.withSolution) p = solver.withSolution(p); } catch (e) { console.warn(e); }
  puzzle = p;
  state = new GameState(p);
  const saved = lsGet(K_PROG(p.id));
  if (saved) { try { state.restore(JSON.parse(saved)); } catch { /* ignore */ } }
  state.addEventListener('change', onChange);

  hud.showScreen('game');
  hud.buildGame(p, { portrait: () => '', clueText: clueTextFn, noteText: noteTextFn });

  try {
    if (!BoardViewClass) throw new Error('Board renderer unavailable');
    board = new BoardViewClass(hud.canvasEl);
    board.loadPuzzle(p);
    wireBoard();
    // portraits
    document.querySelectorAll('#suspects .card').forEach(el => {
      const ch = p.characters.find(c => c.id === el.dataset.id);
      try { el.querySelector('img').src = BoardViewClass.portrait(ch, 128); } catch { /* ignore */ }
    });
  } catch (e) {
    console.error(e);
    board = null;
    hud.showCanvasError('Could not start the 3D board. Please make sure WebGL is enabled in your browser, then reload.');
  }

  lastTick = performance.now();
  timerHandle = setInterval(tick, 500);
  onChange();
}

function tick() {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (!state || state.solved || document.hidden || hud.anyModalOpen()) return;
  state.elapsed += Math.min(dt, 2);
  hud.setTimer(state.elapsed);
}

function saveNow() {
  if (!state || !puzzle) return;
  lsSet(K_PROG(puzzle.id), JSON.stringify(state.serialize()));
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function onChange() {
  if (!state) return;
  board?.setState(state.toView(hover));
  hud.refresh(state);
  hud.setTimer(state.elapsed);
  scheduleSave();
}

function pushView() { board?.setState(state.toView(hover)); }

function needSelection() {
  if (state.selected) return false;
  hud.toast('Pick a suspect first');
  sfx.error();
  return true;
}

function wireBoard() {
  board.on('cellTap', ({ r, c }) => {
    if (!state) return;
    if (state.tool === 'note') {
      if (needSelection()) return;
      if (state.toggleNote(r, c, state.selected)) sfx.note();
    } else if (state.tool === 'x') {
      if (state.toggleMark(r, c) !== false) sfx.mark();
    } else {
      if (state.eraseCell(r, c)) sfx.remove();
    }
  });
  board.on('cellPaint', ({ r, c, start }) => {
    if (!state) return;
    // First paint event of a drag also carries the cell where the press began: paint it first.
    if (start && !paintActive) paintCell(start.r, start.c);
    paintCell(r, c);
  });
  function paintCell(r, c) {
    if (state.tool === 'note') {
      if (needSelection()) return;
      if (!paintActive) { state.checkpoint(); paintActive = true; }
      state.paintNote(r, c, state.selected);
    } else if (state.tool === 'x') {
      if (!paintActive) { state.checkpoint(); paintActive = true; markPaintMode = !state.hasMark(r, c); }
      state.paintMark(r, c, markPaintMode);
    } else {
      if (!paintActive) { state.checkpoint(); paintActive = true; }
      state.eraseCell(r, c);
    }
  }
  board.on('cellHold', ({ r, c }) => {
    if (!state || state.solved) return;
    // Eraser is independent of the selected suspect: a long press erases too.
    if (state.tool === 'erase') { if (state.eraseCell(r, c)) sfx.remove(); return; }
    if (needSelection()) return;
    const id = state.selected;
    const here = state.placements[id];
    if (here && here.r === r && here.c === c) { state.unplace(id); sfx.remove(); return; }
    const conflict = state.conflictAt(id, r, c);
    if (conflict) {
      const who = state.puzzle.characters.find(ch => ch.id === conflict)?.name ?? conflict;
      const p = state.placements[conflict];
      const line = p.r === r ? 'row' : 'column';
      hud.toast(`**${who}** is already in that ${line}. One person per row and column!`);
      sfx.error();
      board.playWrong([conflict]);
      return;
    }
    if (state.place(id, r, c)) sfx.place();
    else { hud.toast("Something is in the way. Pick another cell."); sfx.error(); }
  });
  board.on('tokenTap', ({ id }) => { state.select(state.selected === id ? null : id); sfx.select(); });
  board.on('cellHover', (cell) => { hover = cell; if (state) pushView(); });
}

// ---------- actions ----------
function onAction(action, payload) {
  switch (action) {
    case 'select':
      if (!state) return;
      state.select(state.selected === payload ? null : payload); sfx.select(); break;
    case 'tool': state?.setTool(payload); sfx.click(); break;
    case 'clearall': if (state) { state.clearAll(); sfx.remove(); hud.toast('Board cleared (Undo brings it back)'); } break;
    case 'undo': if (state?.undo()) sfx.undo(); break;
    case 'hint': doHint(); break;
    case 'submit': doSubmit(); break;
    case 'help': sfx.click(); hud.showHelp(); break;
    case 'mute': {
      const m = !sfx.muted; sfx.setMuted(m); hud.setMuted(m); lsSet(K_MUTE, m ? '1' : '0'); if (!m) sfx.click(); break;
    }
    case 'back': sfx.click(); showMenu(); break;
    case 'resetcam': sfx.click(); board?.resetCamera(); break;
    case 'random': sfx.click(); generateRandom(); break;
    case 'winback': hud.closeModals(); showMenu(); break;
    case 'winnext': nextCase(); break;
  }
}

function nextCase() {
  hud.closeModals();
  if (source?.kind === 'case' && source.index + 1 < CASES.length) startCase(source.index + 1);
  else if (source?.kind === 'random') {
    const opts = source.opts;
    try {
      loadPuzzle(generatePuzzle({ ...opts, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }));
    } catch (e) { hud.showError('Oops', `Couldn't generate a case: ${e.message || e}`); showMenu(); }
  } else showMenu();
}

function doHint() {
  if (!state || state.solved) return;
  sfx.hint();
  if (!getHint) { hud.toast('Hints are not available yet.'); return; }
  let h;
  try { h = getHint(puzzle, state.placements); } catch (e) { console.error(e); hud.toast('No hint this time.'); return; }
  if (!h) return;
  hud.toast(h.message || 'Keep going!', { ms: 6000, kind: h.kind === 'wrong' ? 'bad' : '' });
  if (!board) return;
  if (h.kind === 'deduce' && h.cell) board.highlightCells([h.cell], '#ffd84d', 3000);
  else if (h.kind === 'narrow' && h.cells) board.highlightCells(h.cells, '#8fd3ff', 3000);
  else if (h.kind === 'wrong' && state.placements[h.charId]) board.highlightCells([state.placements[h.charId]], '#ff7a7a', 3000);
}

function doSubmit() {
  if (!state || !state.allPlaced() || state.solved) return;
  let res;
  try { res = solver.checkSolution(puzzle, state.placements); }
  catch (e) { console.error(e); hud.toast('Cannot check the answer right now.', { kind: 'bad' }); return; }
  if (res.correct) {
    state.solved = true;
    saveNow();
    markSolved(puzzle.id);
    hud.refresh(state);
    const victim = puzzle.characters.find(c => c.victim);
    let murdererId = puzzle.murderer;
    try { murdererId = solver.murdererOf(puzzle, state.placements) || murdererId; } catch { /* ignore */ }
    board?.playWin({ victimId: victim?.id, murdererId });
    sfx.win();
    clearTimeout(winTimeout);
    winTimeout = setTimeout(() => {
      const m = puzzle.characters.find(c => c.id === murdererId);
      let src = '';
      try { src = BoardViewClass.portrait(m, 240); } catch { /* ignore */ }
      hud.showWin({
        name: m ? m.name : '???', portraitSrc: src, time: state.elapsed,
        hasNext: source?.kind === 'random' ? !!generatePuzzle : (source?.index ?? 0) + 1 < CASES.length,
      });
    }, 1800);
  } else {
    const ids = res.wrongIds || [];
    board?.playWrong(ids);
    sfx.error();
    const names = ids.map(id => puzzle.characters.find(c => c.id === id)?.name).filter(Boolean);
    hud.toast(names.length ? `Not quite! Check: **${names.join(', ')}**` : 'Not quite right. Keep investigating!', { kind: 'bad', ms: 4500 });
  }
}

// ---------- keyboard ----------
function onKey(e) {
  if (e.target.closest?.('select, input, textarea')) return;
  if (e.key === 'Escape') { if (hud.anyModalOpen()) hud.closeModals(); else state?.select(null); return; }
  if (!state || hud.anyModalOpen()) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (state.undo()) sfx.undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (/^[1-9]$/.test(k)) {
    const ch = puzzle.characters[+k - 1];
    if (ch) { state.select(ch.id); sfx.select(); }
  } else if (k === 'n') state.setTool('note');
  else if (k === 'x') state.setTool('x');
  else if (k === 'e') state.setTool('erase');
}

init();
