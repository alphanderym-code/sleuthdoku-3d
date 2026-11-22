// WebAudio-synthesized cartoon SFX. No audio files. Never throws.
const KEY = 'sleuthdoku.muted';
const MASTER = 0.25;

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;
let lastHover = 0;

try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }

function ac() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  return ctx;
}

// tone: freq (or [from,to] sweep), start offset, duration, type, volume
function tone(c, freq, t0, dur, type = 'sine', vol = 0.5) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const [f1, f2] = Array.isArray(freq) ? freq : [freq, freq];
  const t = c.currentTime + t0;
  o.frequency.setValueAtTime(f1, t);
  if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(c, t0, dur, vol = 0.3, hp = 1500) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain();
  const t = c.currentTime + t0;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

function play(fn) {
  try {
    if (muted) return;
    const c = ac();
    if (!c) return;
    fn(c);
  } catch (e) { /* never throw */ }
}

export const sfx = {
  select() { play((c) => { tone(c, 660, 0, 0.09, 'triangle', 0.4); tone(c, 880, 0.07, 0.12, 'triangle', 0.4); }); },
  note() { play((c) => { tone(c, 1400, 0, 0.04, 'square', 0.12); }); },
  place() { play((c) => { tone(c, [220, 520], 0, 0.18, 'sine', 0.6); tone(c, [440, 1040], 0, 0.1, 'sine', 0.15); }); },
  remove() { play((c) => { tone(c, [600, 150], 0, 0.14, 'sine', 0.5); }); },
  mark() { play((c) => { noise(c, 0, 0.1, 0.35, 2500); tone(c, 300, 0, 0.06, 'sawtooth', 0.1); }); },
  undo() { play((c) => { tone(c, [700, 450], 0, 0.1, 'triangle', 0.35); tone(c, [500, 330], 0.09, 0.1, 'triangle', 0.35); }); },
  error() { play((c) => { tone(c, 130, 0, 0.14, 'sawtooth', 0.4); tone(c, 110, 0.16, 0.2, 'sawtooth', 0.4); }); },
  hint() { play((c) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(c, f, i * 0.06, 0.18, 'sine', 0.3)); }); },
  win() {
    play((c) => {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(c, f, i * 0.12, i === 6 ? 0.5 : 0.16, 'triangle', 0.45));
      tone(c, 262, 0, 0.8, 'sine', 0.2);
    });
  },
  click() { play((c) => { tone(c, 1000, 0, 0.025, 'square', 0.12); }); },
  hover() {
    play((c) => {
      const now = Date.now();
      if (now - lastHover < 60) return;
      lastHover = now;
      tone(c, 1800, 0, 0.02, 'sine', 0.03);
    });
  },
  setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
  },
  get muted() { return muted; },
};
