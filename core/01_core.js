'use strict';
// ============================================================
//  Core: canvas, input, audio, helpers
// ============================================================
const W = GAME.screen.w, H = GAME.screen.h, S = GAME.screen.scale, T = GAME.screen.tile, D = GAME.screen.density; // game.json (e.g. 640x360, 2x, 32 px tiles); D: art density (logical px -> 2x2 screen px)
const cv = document.getElementById('screen');
cv.width = W * S; cv.height = H * S;
const X = cv.getContext('2d'); X.imageSmoothingEnabled = false;
const lo = document.createElement('canvas'); lo.width = W * D; lo.height = H * D;
const L = lo.getContext('2d'); L.setTransform(D, 0, 0, D, 0, 0); L.imageSmoothingEnabled = false;
const FONT = THEME_DEF.fonts.body;   // the theme's body font (job fw-F4; a theme sets it, with a fallback face)
let frame = 0;

// a cast sprite from a hi-res sheet (c.q = its resolution factor, see sheetQ in 02d) is drawn smoothed; everything else stays crisp
function drawSpr(g, s, x, y, w, h) { const hi = (s.q || 1) > 1; if (hi) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; } g.drawImage(s, x, y, w, h); if (hi) g.imageSmoothingEnabled = false; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
// Job tests-4: every random choice that only shapes the SOUND (noise, blips, takes, variants, where a loop starts) uses arand(). On a test page
// that is its own seeded stream (testlib.py), so audio, which runs on real-time timers and async decoding, never moves the game's Math.random.
const arand = () => (window.AUDIO_RANDOM || Math.random)();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------------- Input ----------------
const Input = { down: {}, pressed: {}, hold: {}, touchMode: false };
const KEYMAP = {};   // key code -> action; filled from the control-scheme table CONTROL_KEYS (01b_input.js, job a11y)
function press(k) { if (!Input.down[k]) { Input.pressed[k] = true; Input.hold[k] = 0; } Input.down[k] = true; audioInit(); }
function release(k) { Input.down[k] = false; }
window.addEventListener('keydown', e => {
  if (e.code === 'KeyN') { toggleSound(); return; }
  const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); if (!e.repeat) press(k);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { e.preventDefault(); release(k); } });
window.addEventListener('blur', () => { Input.down = {}; });
cv.addEventListener('pointerdown', () => { cv.focus(); audioInit(); });
document.querySelectorAll('.pad button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); b.classList.add('on'); press(k); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = e => { e.preventDefault(); b.classList.remove('on'); release(k); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
function setTouch(on) { Input.touchMode = on; document.body.classList.toggle('touch', on); document.getElementById('padBtn').textContent = on ? 'Hide pad' : 'Touch pad'; }
if (matchMedia('(pointer: coarse)').matches) setTouch(true);
document.getElementById('padBtn').addEventListener('click', () => setTouch(!Input.touchMode));
function inputEndFrame() {
  for (const k in Input.down) if (Input.down[k]) Input.hold[k] = (Input.hold[k] || 0) + 1;
  Input.pressed = {};
  if (typeof padPoll === 'function') padPoll();   // job a11y: the gamepad's presses land for the next update (01b_input.js)
}
const btn = k => !!Input.pressed[k];
const held = k => !!Input.down[k];
// menu navigation with auto-repeat
function nav(k) { if (Input.pressed[k]) return true; const h = Input.hold[k] || 0; return Input.down[k] && h > 16 && h % 5 === 0; }

// ---------------- Audio ----------------
const Snd = { ctx: null, on: true, master: null, musicGain: null, noise: null };
const MUSIC_LEVEL = 0.55;   // the music bus (playSong dips it and brings it back to this)
function audioInit() {
  if (Snd.ctx) { if (Snd.ctx.state === 'suspended') Snd.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    Snd.ctx = new AC();
    Snd.master = Snd.ctx.createGain(); Snd.master.gain.value = Snd.on ? 0.22 : 0; Snd.master.connect(Snd.ctx.destination);
    Snd.musicGain = Snd.ctx.createGain(); Snd.musicGain.gain.value = MUSIC_LEVEL; Snd.musicGain.connect(Snd.master);
    Snd.ambGain = Snd.ctx.createGain(); Snd.ambGain.gain.value = AMB_LEVEL; Snd.ambGain.connect(Snd.master);   // Job 9b ambience bed
    Snd.sfxGain = Snd.ctx.createGain(); Snd.sfxGain.gain.value = 1; Snd.sfxGain.connect(Snd.master);           // Job 9b effect files
    const len = Snd.ctx.sampleRate * 0.5, buf = Snd.ctx.createBuffer(1, len, Snd.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = arand() * 2 - 1;
    Snd.noise = buf;
    if (Music.name) { const n = Music.name; Music.name = null; playMusic(n); }
    if (Amb.name) { const n = Amb.name; Amb.name = null; playAmb(n); }
    sfxPrefetch();
  } catch (e) { Snd.ctx = null; }
}
function toggleSound() {
  Snd.on = !Snd.on;
  if (Snd.master) Snd.master.gain.value = Snd.on ? 0.22 : 0;
  document.getElementById('sndBtn').textContent = 'Sound: ' + (Snd.on ? 'on' : 'off');
  try { localStorage.setItem(GAME.soundKey, Snd.on ? '1' : '0'); } catch (e) {}
}
document.getElementById('sndBtn').addEventListener('click', () => { audioInit(); toggleSound(); });
try { if (localStorage.getItem(GAME.soundKey) === '0') { Snd.on = true; toggleSound(); } } catch (e) {}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function note(freq, t, dur, type = 'square', vol = 0.3, dest) {
  const c = Snd.ctx; if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || Snd.master); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noiseHit(t, dur, vol, hp = 1000, dest) {
  const c = Snd.ctx; if (!c || !Snd.noise) return;
  const s = c.createBufferSource(); s.buffer = Snd.noise;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || Snd.master); s.start(t); s.stop(t + dur + 0.02);
}
function taiko(t, vol = 0.9, dest) {
  const c = Snd.ctx; if (!c) return;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(dest || Snd.master); o.start(t); o.stop(t + 0.4);
}
function sfx(name, vol) {   // vol (optional): scales a recorded effect (the stampede's many footfalls, 05j)
  const c = Snd.ctx; if (!c || !Snd.on) return; const t = c.currentTime + 0.005;
  if (sfxFile(name, t, vol)) return;   // Job 9b: the recorded effect when its file is loaded (below the music section)
  switch (name) {
    case 'cursor': note(1320, t, 0.04, 'square', 0.12); break;
    case 'ok': note(988, t, 0.05, 'square', 0.15); note(1480, t + 0.05, 0.07, 'square', 0.15); break;
    case 'back': note(660, t, 0.05, 'square', 0.12); note(440, t + 0.05, 0.06, 'square', 0.12); break;
    case 'talk': note(1760 + arand() * 200, t, 0.02, 'square', 0.04); break;
    case 'door': noiseHit(t, 0.18, 0.25, 400); note(180, t, 0.12, 'triangle', 0.3); break;
    case 'bump': note(90, t, 0.06, 'square', 0.12); break;
    case 'slash': noiseHit(t, 0.12, 0.5, 2500); note(1800, t, 0.05, 'sawtooth', 0.08); break;
    case 'hit': noiseHit(t, 0.14, 0.45, 300); note(120, t, 0.1, 'square', 0.2); break;
    case 'crit': noiseHit(t, 0.25, 0.6, 200); taiko(t, 0.8); note(2200, t, 0.08, 'sawtooth', 0.1); break;
    case 'miss': note(400, t, 0.08, 'triangle', 0.2); note(300, t + 0.06, 0.08, 'triangle', 0.2); break;
    case 'heal': [72, 76, 79, 84].forEach((m, i) => note(mtof(m + 12), t + i * 0.06, 0.12, 'triangle', 0.25)); break;
    case 'ki': [81, 76, 81, 88].forEach((m, i) => note(mtof(m), t + i * 0.05, 0.1, 'sine', 0.25)); break;
    case 'fire': noiseHit(t, 0.5, 0.5, 150); taiko(t, 0.5); break;
    case 'item': [76, 81, 88].forEach((m, i) => note(mtof(m), t + i * 0.07, 0.12, 'square', 0.14)); break;
    case 'encounter': [64, 65, 64, 65, 76].forEach((m, i) => note(mtof(m), t + i * 0.05, 0.08, 'square', 0.18)); noiseHit(t + 0.25, 0.3, 0.4, 800); break;
    case 'levelup': [69, 72, 76, 81, 76, 81, 84].forEach((m, i) => note(mtof(m), t + i * 0.08, 0.14, 'square', 0.16)); break;
    case 'flee': [72, 67, 64, 60].forEach((m, i) => note(mtof(m), t + i * 0.04, 0.06, 'square', 0.12)); break;
    case 'stamp': taiko(t, 1); taiko(t + 0.18, 0.7); noiseHit(t, 0.3, 0.4, 300); break;
    case 'coin': note(1976, t, 0.05, 'square', 0.12); note(2637, t + 0.05, 0.1, 'square', 0.12); break;
    case 'step': noiseHit(t, 0.05, 0.22, 500); note(110, t, 0.05, 'triangle', 0.2); break;
    case 'stairs': for (let i = 0; i < 6; i++) { noiseHit(t + i * 0.13, 0.05, 0.2, 500); note(100 + i * 6, t + i * 0.13, 0.05, 'triangle', 0.18); } break;
    case 'warp': [60, 67, 72, 79, 84, 91].forEach((m, i) => note(mtof(m), t + i * 0.05, 0.14, 'sine', 0.2)); noiseHit(t, 0.35, 0.12, 3000); break;
    case 'echo': [0, 0.16, 0.34, 0.58].forEach((d, i) => note(196 / (1 + i * 0.08), t + d, 0.3, 'triangle', 0.22 / (1 + i))); noiseHit(t, 0.4, 0.1, 250); break;
    case 'deny': note(160, t, 0.1, 'square', 0.18); note(140, t + 0.1, 0.12, 'square', 0.18); break;
    // Job 16c (the festival sumo): procedural stand-ins until the recorded takes exist
    case 'clap': noiseHit(t, 0.04, 0.35, 2600); noiseHit(t + 0.11, 0.04, 0.3, 2400); break;
    case 'thud': noiseHit(t, 0.16, 0.5, 180); taiko(t, 0.55); break;
    case 'roar': for (let i = 0; i < 8; i++) noiseHit(t + i * 0.07, 0.35, 0.09, 700 + i * 90); break;
  }
}

// ---------------- Music sequencer ----------------
// Tokens per 8th note: note name (e.g. A4, Bb3, F#5), '-' hold, 'r' rest. Drum channel: k (taiko), s (snare), h (hat), '.' rest.
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nameToMidi(n) { const m = n.match(/^([A-G])(#|b)?(-?\d)$/); if (!m) return null; let v = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return v + (parseInt(m[3]) + 1) * 12; }
function parseTrack(tr) {
  const ch = tr.ch.map(c => {
    const toks = c.n.trim().split(/\s+/).filter(t => t !== '|');
    const ev = new Array(toks.length);
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (c.drum) { if (tk !== '.' && tk !== 'r') ev[i] = { d: tk }; continue; }
      const m = nameToMidi(tk); if (m == null) continue;
      let len = 1; while (toks[i + len] === '-') len++;
      ev[i] = { f: mtof(m), len };
    }
    return { ev, w: c.w || 'square', v: c.v == null ? 0.25 : c.v, drum: !!c.drum, len: toks.length };
  });
  return { bpm: tr.bpm, loop: tr.loop !== false, ch, len: Math.max(...ch.map(c => c.len)) };
}
// Job 9a: audio-file music. A TRACKS entry may carry file: '<name>' (+ optional loopStart / loopEnd in seconds, start
// (where playback begins, default loopStart; 0 for songs with an intro) and vol).
// window.AUDIO_SRC maps that name to a URL (the multi-file Chapter One page: 'audio/<name>.mp3'). The file is fetched and
// decoded once, looped on Snd.musicGain, and every track change crossfades (XFADE s). If the page has no such file, or
// fetching/decoding fails, the track's procedural chiptune (bpm/ch) plays instead, so every page still has music.
// Each playback (file or chiptune) gets its own gain 'voice', which is what fades. The dance keeps the chiptune bonodori.
const Music = { name: null, cur: null, step: 0, next: 0, voice: null, file: null, src: null, mode: null };
// Compressed files are fetched once and kept (about 1.4 MB each; all of them are prefetched after the first one plays); decoded
// buffers are big (about 33 MB per 85 s of stereo), so only the MFILE_KEEP most recently used stay decoded.
const MFile = { raw: {}, buf: {}, wait: {}, bad: {}, used: [] };
const XFADE = 0.6, MFILE_KEEP = 3;
function musicFileUrl(tr) { const A = window.AUDIO_SRC; return tr && tr.file && A && A[tr.file] && !MFile.bad[tr.file] ? A[tr.file] : null; }
function musicFetch(file, url) {
  if (!MFile.raw[file]) MFile.raw[file] = fetch(url).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
    .catch(e => { MFile.bad[file] = true; delete MFile.raw[file]; throw e; });
  return MFile.raw[file];
}
function musicLoad(file, url) {
  if (MFile.buf[file]) return Promise.resolve(MFile.buf[file]);
  if (!Snd.ctx) return musicFetch(file, url).then(() => { throw new Error('no audio yet'); });   // Job 16c: before the first key there is nothing to decode with; fetch only, never mark the file bad
  if (!MFile.wait[file]) MFile.wait[file] = musicFetch(file, url)
    .then(ab => new Promise((ok, no) => Snd.ctx.decodeAudioData(ab.slice(0), ok, no)))   // decode a copy: decoding detaches the buffer
    .then(b => { delete MFile.wait[file]; MFile.buf[file] = b; musicKeep(file); return b; },
      e => { MFile.bad[file] = true; delete MFile.wait[file]; throw e; });
  return MFile.wait[file];
}
function musicKeep(file) {
  MFile.used = MFile.used.filter(f => f !== file).concat(file);
  while (MFile.used.length > MFILE_KEEP) { const f = MFile.used.shift(); if (f !== Music.file) delete MFile.buf[f]; else MFile.used.push(f); }
}
let musicPrefetched = false;
function musicPrefetch() {
  if (musicPrefetched || !window.AUDIO_SRC) return; musicPrefetched = true;
  Object.keys(window.AUDIO_SRC).filter(f => f.startsWith('music_')).reduce((p, f) => p.then(() => musicFetch(f, window.AUDIO_SRC[f]).catch(() => {})), Promise.resolve());   // amb_/sfx_ load on their own (Job 9b)
}
function musicVoice(vol, fadeIn) {
  const c = Snd.ctx, g = c.createGain(), t = c.currentTime;
  if (fadeIn) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + XFADE); } else g.gain.setValueAtTime(vol, t);
  g.connect(Snd.musicGain); return g;
}
function musicFadeOut() {
  const c = Snd.ctx, g = Music.voice, s = Music.src; if (!c || !g) return;
  const t = c.currentTime;
  try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + XFADE); } catch (e) {}
  if (s) try { s.stop(t + XFADE + 0.05); } catch (e) {}
  setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (XFADE + 0.3) * 1000);
  Music.voice = null; Music.src = null;
}
function musicStartChip(name, fade) {
  Music.cur = name && contentGet('music', name) ? parseTrack(contentGet('music', name)) : null; Music.mode = Music.cur ? 'chip' : null; Music.file = null;
  Music.step = 0; Music.next = Snd.ctx.currentTime + 0.08;
  if (Music.cur) Music.voice = musicVoice(1, false);
}
function musicStartFile(name, tr, buf) {
  const c = Snd.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = tr.loop !== false;
  const ls = tr.loopStart || 0, le = tr.loopEnd && tr.loopEnd <= buf.duration ? tr.loopEnd : buf.duration;
  if (s.loop) { s.loopStart = ls; s.loopEnd = le; }
  Music.voice = musicVoice(tr.vol == null ? 1 : tr.vol, true); s.connect(Music.voice);
  const off = tr.start != null ? tr.start : ls; s.start(c.currentTime + 0.02, off);   // start: 0 = an intro that plays once, then A..B loops
  Music.fileT0 = c.currentTime + 0.02 - off;   // Job 16c: the audio-clock time of the file's 0 s (the dance scores its beats against it)
  Music.src = s; Music.mode = 'file'; Music.file = tr.file; Music.cur = null;
  musicKeep(tr.file); musicPrefetch();
}
function playMusic(name) {
  if (Music.name === name && (Music.cur || Music.mode === 'file' || Music.mode === 'loading')) return;
  Music.name = name;
  if (!Snd.ctx) return;
  let tr = name && contentGet('music', name);
  if (tr && tr.alts) tr = Object.assign({}, tr, tr.alts[Math.floor(arand() * tr.alts.length)]);   // Job 9b: several takes, one per play
  const url = musicFileUrl(tr);
  const swap = () => { musicFadeOut(); Music.cur = null; Music.mode = null; Music.file = null; };
  if (!url) { swap(); musicStartChip(name); return; }
  if (MFile.buf[tr.file]) { swap(); musicStartFile(name, tr, MFile.buf[tr.file]); return; }
  // not decoded yet: whatever is playing keeps playing until the new file is ready, then they crossfade (no gap of silence)
  Music.mode = 'loading';
  musicLoad(tr.file, url).then(b => { if (Music.name === name && Music.mode === 'loading') { swap(); musicStartFile(name, tr, b); } },
    () => { if (Music.name === name && Music.mode === 'loading') { swap(); musicStartChip(name); } });
}
function musicTick() {
  if (!Snd.ctx || !Music.cur) return;
  const tr = Music.cur, sp = 60 / tr.bpm / 2, c = Snd.ctx, out = Music.voice || Snd.musicGain;
  if (Music.next < c.currentTime - 0.5) Music.next = c.currentTime + 0.05;
  while (Music.next < c.currentTime + 0.2) {
    for (const ch of tr.ch) {
      const ev = ch.ev[Music.step % ch.len]; if (!ev) continue;
      if (ch.drum) {
        if (ev.d === 'k') taiko(Music.next, ch.v * 1.6, out);
        else if (ev.d === 's') noiseHit(Music.next, 0.12, ch.v, 1200, out);
        else if (ev.d === 'h') noiseHit(Music.next, 0.04, ch.v * 0.5, 6000, out);
      } else note(ev.f, Music.next, ev.len * sp * 0.95, ch.w, ch.v, out);
    }
    Music.step++; Music.next += sp;
    if (Music.step >= tr.len) { if (tr.loop) Music.step = 0; else { Music.cur = null; if (Music.mode === 'chip') Music.mode = null; break; } }
  }
}
setInterval(musicTick, 30);

// ---------------- A sung one-shot over the music (Job 8g-r3: a companion's planting song) ----------------
// playSong(name) plays TRACKS[name].file ONCE (loop: false, like the victory sting) on its own gain straight to the master,
// while the music bus (Snd.musicGain) dips to SONG_DUCK of its level and the ambience bed to SONG_AMB_DUCK; when the take
// ends the music comes back over SONG_BACK s. Whatever music is playing keeps playing underneath (a track change during the
// song is ducked too: the bus is what dips). The file is a music_ file, so musicPrefetch has its bytes already; it is decoded
// when asked for and dropped afterwards (about 15 MB decoded). stopSong() fades it out (SONG_FADE s) and lifts the dip;
// songTick stops it if the player leaves the scene, a battle starts or the title comes up. songBusy() is true while it loads
// or plays: the story step { songWait: 1 } (05d_story.js) holds the scene until it ends, and a confirm press fades it out.
// playSong(name, singer): notes rise over that follower or NPC while it plays (05i_song.js).
// A page without the file (no AUDIO_SRC, a failed load) plays nothing and ducks nothing.
const SONG_DUCK = 0.06, SONG_AMB_DUCK = 0.35, SONG_FADE = 1.2, SONG_BACK = 2.0;   // the dip: about -24 dB under a soft hum (Ash, 20 Oct 2026: 0.25 was not enough)
const Song = { name: null, state: null, src: null, voice: null, scene: null, until: 0, buf: {}, singer: null };   // singer: whose head the notes rise from (05i_song.js)
function songDuck(on, fade = SONG_FADE) {
  const c = Snd.ctx; if (!c) return; const t = c.currentTime;
  for (const [g, full, k] of [[Snd.musicGain, MUSIC_LEVEL, SONG_DUCK], [Snd.ambGain, AMB_LEVEL, SONG_AMB_DUCK]]) {
    if (!g) continue;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(on ? full * k : full, t + (on ? fade : SONG_BACK)); } catch (e) {}
  }
}
function songClear() { const g = Song.voice; Song.name = Song.state = Song.src = Song.voice = Song.singer = null; Song.buf = {}; if (g) setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (SONG_FADE + 0.3) * 1000); }
function playSong(name, singer) {
  if (Song.state) stopSong();
  Song.singer = singer || null;
  const tr = contentGet('music', name), A = window.AUDIO_SRC, c = Snd.ctx;
  if (!c || !tr || !tr.file || !A || !A[tr.file]) return false;
  Song.name = name; Song.state = 'loading'; Song.scene = typeof SC === 'object' ? SC.id : null;
  const play = b => {
    if (Song.name !== name || Song.state !== 'loading') return;
    const s = c.createBufferSource(), g = c.createGain(), t = c.currentTime + (tr.delay ?? SONG_FADE);
    const offset = clamp(tr.start || 0, 0, b.duration), duration = Math.min(tr.duration ?? b.duration, b.duration - offset);
    g.gain.value = (tr.vol == null ? 1 : tr.vol) * MUSIC_LEVEL; s.buffer = b; s.connect(g); g.connect(Snd.master);
    s.onended = () => { if (Song.src === s) { songClear(); songDuck(false); } };
    if (tr.fadeOut) { g.gain.setValueAtTime(g.gain.value, t + Math.max(0, duration - tr.fadeOut)); g.gain.linearRampToValueAtTime(0.0001, t + duration); }
    songDuck(true, tr.duckFade ?? SONG_FADE); s.start(t, offset, duration);
    Object.assign(Song, { state: 'playing', src: s, voice: g, t0: t, until: t + duration });
  };
  (Song.buf[tr.file] ? Promise.resolve(Song.buf[tr.file])
    : musicFetch(tr.file, A[tr.file]).then(ab => new Promise((ok, no) => c.decodeAudioData(ab.slice(0), ok, no))).then(b => (Song.buf[tr.file] = b)))
    .then(play, () => { if (Song.name === name) songClear(); });
  return true;
}
function stopSong() {
  const c = Snd.ctx, g = Song.voice, s = Song.src, was = Song.state;
  if (c && g && s) {
    const t = c.currentTime; s.onended = null;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + SONG_FADE); s.stop(t + SONG_FADE + 0.05); } catch (e) {}
  }
  songClear();
  if (was === 'playing') songDuck(false);
}
const songBusy = () => !!Song.state;
function songTick() {
  if (!Song.state) return;
  if (typeof G !== 'object' || G.state !== 'scene' || typeof SC !== 'object' || SC.id !== Song.scene) { stopSong(); return; }
  if (Song.state === 'playing' && Snd.ctx && Snd.ctx.currentTime > Song.until + 1) { songClear(); songDuck(false); }   // onended never came
}
setInterval(songTick, 250);

// ---------------- Ambience and sound-effect files (Job 9b) ----------------
// Ambience: one looping bed under the music on its own gain (Snd.ambGain, AMB_LEVEL), chosen by where the player is: the
// painted scene's entry in the content kind `ambience` ({ scenes: { scene id: a key or a function of the story flags }, sleep: { place: key }, night: key }), nothing in battles, on the title, in the dance
// or in old tile maps. ambTick() checks every 250 ms and crossfades (AMB_FADE s) when the wanted bed changes, so no other
// file needs a hook. Files come from window.AUDIO_SRC like the music ('amb_<key>'); a page without them is silent here.
// SFX: sfx(name) plays 'sfx_<name>' from AUDIO_SRC when that file is decoded (all are fetched and decoded once, after the
// first sound; about 50 small files), else the procedural sound below, so nothing goes quiet while they load.
// SFX_VARIANTS: names with extra takes (sfx_<name>_2, _3), picked at random so repeated steps and hits differ.
const AMB_LEVEL = 0.45, AMB_FADE = 1.5;
const AMB_LOOPS = { loopStart: 1, loopEnd: 31 };   // every amb_ file: [1 s pre-roll] + 30 s loop + [1 s post-roll] (make_sfx.py)
// SFX levels by group (files are all levelled to the same loudness by make_sfx.py; these set how loud each group sits)
const SFX_VOL = { clap: 0.55, roar: 0.5,   /* Job 16c */ cursor: 0.3, ok: 0.35, back: 0.3, deny: 0.35, talk: 0.16, menu_open: 0.35, card_turn: 0.4, item: 0.45, coin: 0.45, save: 0.5,
  step: 0.35, step_wood: 0.35, stairs: 0.45, door: 0.5, door_heavy: 0.55, bump: 0.4, splash: 0.45, pickup: 0.45, warp: 0.55, echo: 0.5 };
const SFX_VOL_DEFAULT = 0.7;   // battle and story sounds
const SFX_VARIANTS = { step: 3, hit: 3, slash: 3 };
const SFX_GAP = { talk: 0.12 };   // the typing sound plays at most this often (s)
const Amb = { name: null, voice: null, src: null, want: undefined };
const AFile = { buf: {}, wait: {}, bad: {} };
function audioFileLoad(store, file) {
  const A = window.AUDIO_SRC; if (!A || !A[file] || store.bad[file] || !Snd.ctx) return Promise.reject(new Error('no file'));
  if (store.buf[file]) return Promise.resolve(store.buf[file]);
  if (!store.wait[file]) store.wait[file] = fetch(A[file]).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((ok, no) => Snd.ctx.decodeAudioData(ab, ok, no)))
    .then(b => { delete store.wait[file]; store.buf[file] = b; return b; }, e => { store.bad[file] = true; delete store.wait[file]; throw e; });
  return store.wait[file];
}
function ambFadeOut() {
  const c = Snd.ctx, g = Amb.voice, s = Amb.src; if (!c || !g) return;
  const t = c.currentTime;
  try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + AMB_FADE); } catch (e) {}
  if (s) try { s.stop(t + AMB_FADE + 0.05); } catch (e) {}
  setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (AMB_FADE + 0.3) * 1000);
  Amb.voice = null; Amb.src = null;
}
function playAmb(name) {
  if (Amb.name === name) return;
  Amb.name = name;
  if (!Snd.ctx || !Snd.ambGain) return;
  if (!name) { ambFadeOut(); return; }
  audioFileLoad(AFile, name).then(b => {
    if (Amb.name !== name) return;
    ambFadeOut();
    const c = Snd.ctx, s = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    s.buffer = b; s.loop = true; s.loopStart = AMB_LOOPS.loopStart; s.loopEnd = Math.min(AMB_LOOPS.loopEnd, b.duration);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + AMB_FADE);
    s.connect(g); g.connect(Snd.ambGain); s.start(t + 0.02, AMB_LOOPS.loopStart + arand() * 20);   // a random point, so re-entering doesn't repeat
    Amb.voice = g; Amb.src = s;
  }, () => { if (Amb.name === name) ambFadeOut(); });
}
function sceneAmb() {
  if (typeof SLEEP === 'object' && SLEEP.amb) return SLEEP.amb;   // Job 8g-r5: the night bed while the screen is dark (05i_sleep.js)
  if (typeof G !== 'object' || G.state !== 'scene' || typeof SC !== 'object' || !SC.id) return null;
  const a = (content('ambience').scenes || {})[SC.id]; return (typeof a === 'function' ? a() : a) || null;
}
function ambTick() { try { const w = sceneAmb(); if (w !== Amb.want) { Amb.want = w; playAmb(w); } } catch (e) {} }
setInterval(ambTick, 250);
let sfxPrefetched = false;
function sfxPrefetch() {
  if (sfxPrefetched || !window.AUDIO_SRC || !Snd.ctx) return; sfxPrefetched = true;
  Object.keys(window.AUDIO_SRC).filter(f => f.startsWith('sfx_')).reduce((p, f) => p.then(() => audioFileLoad(AFile, f).catch(() => {})), Promise.resolve());
}
const SfxLast = {};
// play the file for this effect if it is ready; true = played (or deliberately skipped), false = use the procedural sound
function sfxFile(name, t, vol) {
  const A = window.AUDIO_SRC; if (!A) return false;
  sfxPrefetch();
  let f = 'sfx_' + name; const n = SFX_VARIANTS[name];
  if (n) { const k = 1 + Math.floor(arand() * n); if (k > 1 && AFile.buf[f + '_' + k]) f += '_' + k; }
  const b = AFile.buf[f]; if (!b) return false;
  if (SFX_GAP[name]) { if (SfxLast[name] && t - SfxLast[name] < SFX_GAP[name]) return true; SfxLast[name] = t; }
  const c = Snd.ctx, s = c.createBufferSource(), g = c.createGain();
  g.gain.value = (SFX_VOL[name] != null ? SFX_VOL[name] : SFX_VOL_DEFAULT) * (vol != null ? vol : 1);
  s.buffer = b; s.connect(g); g.connect(Snd.sfxGain || Snd.master); s.start(t);
  s.onended = () => { try { g.disconnect(); } catch (e) {} };
  return true;
}

// ---------------- Hi-res UI drawing (text & windows at 3x) ----------------
function rectH(x, y, w, h, c) { X.fillStyle = c; X.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S)); }
function rr(x, y, w, h, r) { X.beginPath(); if (X.roundRect) X.roundRect(x, y, w, h, r); else X.rect(x, y, w, h); }
// ---------------- UI kit (core/ui). The look is the theme's (job fw-F4, 29 Oct 2026) ----------------
// game.json names a theme (e.g. themes/ink-washi/, 'ink on washi'); its theme.json arrives as THEME_DEF (colours, fonts, sizes) and its
// code registers the widgets these functions draw with (src/01a_game.js, section 8). Every panel drawn this frame is remembered in UI_PANELS,
// so the theme can set text over a panel in its own colours (txt) without touching each call site.
const FONT_HEAD = THEME_DEF.fonts.head;   // themes/<theme>/theme.json fonts.head
const UI = THEME_DEF.colors;              // the colour tokens (theme.json colors: ink, soft, faint, seal, cream, paper...)
const UI_PANELS = [];
function uiFrameStart() { UI_PANELS.length = 0; }
function mulberry(a) { a >>>= 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PANEL_CACHE = new Map();   // a canvas cache the theme's widgets may use (cleared by the theme when it grows)
function win(x, y, w, h, style = 0) {   // a panel (style 1 = a speaker's name tab)
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  themeUI('panel')(x, y, w, h, style);
  UI_PANELS.push({ x, y, w, h, style });
}
function selBar(x, y, w, h) { themeUI('selBar')(x, y, w, h); }   // under the chosen line of a list
const uiPanelAt = (x, y) => { for (let i = UI_PANELS.length - 1; i >= 0; i--) { const p = UI_PANELS[i]; if (x >= p.x && x <= p.x + p.w && y >= p.y - 2 && y <= p.y + p.h) return p; } return null; };
function setFont(size, head) { X.font = head ? `700 ${Math.round(size * 1.08 * S)}px ${FONT_HEAD}` : `500 ${Math.round(size * S)}px ${FONT}`; X.textBaseline = 'top'; }
function txt(s, x, y, col = '#f2e8d2', size = 10, align = 'left', shadow = true) {
  if (hasMark(s)) { txtMark(s, x, y, col, size, align, shadow); return; }
  const [c, head, sh] = themeUI('text')(col, uiPanelAt(x, y + size * 0.5), shadow);
  setFont(size, head); X.textAlign = align;
  if (sh) { X.fillStyle = sh; X.fillText(s, x * S + 2, y * S + 2); }
  X.fillStyle = c; X.fillText(s, x * S, y * S - (head ? size * 0.12 * S : 0));
  X.textAlign = 'left';
}
// Mincho text with a soft shadow, for titles, cards and banners (not tied to a panel)
function headTxt(s, x, y, col = UI.cream, size = 14, align = 'left', weight = 700, shadow = 'rgba(0,0,0,.55)') {
  s = markPlain(s);   // titles and cards show marked text plain
  X.font = `${weight} ${Math.round(size * S)}px ${FONT_HEAD}`; X.textBaseline = 'top'; X.textAlign = align;
  if (shadow) { X.save(); X.shadowColor = shadow; X.shadowBlur = 6; X.shadowOffsetY = 2; X.fillStyle = col; X.fillText(s, x * S, y * S); X.restore(); } else { X.fillStyle = col; X.fillText(s, x * S, y * S); }
  X.textAlign = 'left';
}
function txtW(s, size = 10, head) { if (hasMark(s)) return runsW(markRuns(s), size, head); setFont(size, head); return X.measureText(s).width / S; }
// wrap(s, maxW, size, head): lines of at most maxW logical px; '\n' breaks a line. Marked text (below) is measured as drawn and every line
// keeps its own marks, so txt() draws each wrapped line with its highlight and key caps.
function wrap(s, maxW, size = 10, head) {
  if (hasMark(s)) s = String(s).replace(/\[\[(.+?)\]\]/g, (_, t) => t.split(' ').map(w => '[[' + w + ']]').join(' '));   // a highlight per word, so a line can break inside it
  const mk = hasMark(s), wd = t => mk ? runsW(markRuns(t), size, head) : X.measureText(t).width / S;
  setFont(size, head); const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (wd(t) > maxW && line) { out.push(line); line = w; } else line = t;
      if (mk) setFont(size, head);
    }
    out.push(line);
  }
  return out;
}
// ---------------- marked text (job text-pass, 1 Nov 2026) ----------------
// One small markup for every string the player reads: [[words]] = the game's one highlight (names of people, places and story items;
// the theme's `emphasis` widget gives its colour and weight); {a} {b} {start} {up} {down} {left} {right} = a key cap with that key's
// name in the player's control scheme (the theme's `keyCap` widget); {move} {moveKeys} = the movement keys' names as words.
// txt(), txtW() and wrap() read it; headTxt() shows it plain; the dialogue box draws it letter by letter (05_field.js).
const MARK_RE = /\[\[(.+?)\]\]|\{(a|b|start|up|down|left|right)\}|\{(move|moveKeys)\}/g;
const MARK_TEST = /\[\[|\{(?:a|b|start|up|down|left|right|move|moveKeys)\}/;
const hasMark = s => typeof s === 'string' && MARK_TEST.test(s);
function markRuns(s) {   // -> [{ t, k }]: k '' = plain, 'h' = highlight, 'c' = key cap
  s = String(s); const out = []; let i = 0, m; MARK_RE.lastIndex = 0;
  while ((m = MARK_RE.exec(s))) {
    if (m.index > i) out.push({ t: s.slice(i, m.index), k: '' });
    if (m[1] != null) out.push({ t: m[1], k: 'h' }); else if (m[2]) out.push({ t: keyName(m[2]), k: 'c' }); else out.push({ t: keyName(m[3]), k: '' });
    i = MARK_RE.lastIndex;
  }
  if (i < s.length) out.push({ t: s.slice(i), k: '' });
  return out;
}
const markPlain = s => hasMark(s) ? markRuns(s).map(r => r.t).join('') : s;
const CAP_IN = 3, CAP_OUT = 2;   // a key cap's padding inside its box and its gap outside, logical px
function markFont(r, size, head, onPanel) {
  if (r.k === 'h') { const wt = themeUI('emphasis')(onPanel)[1]; X.font = `${wt} ${Math.round(size * S)}px ${head ? FONT_HEAD : FONT}`; X.textBaseline = 'top'; }
  else setFont(size, head);
}
function runsW(runs, size, head, onPanel = true) {
  let w = 0;
  for (const r of runs) { markFont(r, size, head, onPanel); w += X.measureText(r.t).width / S + (r.k === 'c' ? 2 * (CAP_IN + CAP_OUT) : 0); }
  return w;
}
// draw runs from (x, y) with base colour c (already the theme's), at most n plain characters (the dialogue's typewriter); returns the end x
function drawRuns(runs, x, y, c, size, head, sh, onPanel, n = Infinity) {
  let cx = x, left = n; const [ec] = themeUI('emphasis')(onPanel), dy = head ? size * 0.12 : 0;
  for (const r of runs) {
    if (left <= 0) break;
    const t = r.t.slice(0, left); left -= r.t.length;
    markFont(r, size, head, onPanel);
    if (r.k === 'c') {
      const w = X.measureText(r.t).width / S;
      themeUI('keyCap')(cx + CAP_OUT, y - 2, w + 2 * CAP_IN, size + 4, onPanel);
      cx += CAP_OUT + CAP_IN;
      X.fillStyle = c; X.fillText(t, cx * S, y * S - dy * S); cx += w + CAP_IN + CAP_OUT;
      continue;
    }
    if (sh) { X.fillStyle = sh; X.fillText(t, cx * S + 2, y * S + 2); }
    X.fillStyle = r.k === 'h' ? ec : c; X.fillText(t, cx * S, y * S - dy * S);
    cx += X.measureText(r.t).width / S;
  }
  return cx;
}
function txtMark(s, x, y, col = '#f2e8d2', size = 10, align = 'left', shadow = true, n = Infinity) {
  const p = uiPanelAt(x, y + size * 0.5), [c, head, sh] = themeUI('text')(col, p, shadow), runs = markRuns(s);
  X.textAlign = 'left';
  const w = align === 'left' ? 0 : runsW(runs, size, head, !!p);
  drawRuns(runs, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y, c, size, head, sh, !!p, n);
}
function outlineTxt(s, x, y, col, size = 10, align = 'center') {
  setFont(size); X.textAlign = align; X.fillStyle = UI.outline;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) X.fillText(s, x * S + dx * 2.5, y * S + dy * 2.5);
  X.fillStyle = col; X.fillText(s, x * S, y * S); X.textAlign = 'left';
}
// A front menu in the theme's look (job fw-F4; the title's menu of job title-river-art, for any front screen to reuse): one panel of options
// with the chosen one marked, an optional summary line under the first option (Continue: where, level, play time) and a footer hint.
// bottom = the panel's bottom edge; returns the panel's rectangle.
function frontMenu(x, bottom, w, opts, sel, summary, hint) {
  const h = opts.length * 27 + 42 + (summary ? 20 : 0), y = bottom - h;
  win(x, y, w, h);
  opts.forEach((o, i) => { const oy = y + 13 + i * 27 + (summary && i > 0 ? 20 : 0); txt(o, x + 29, oy, i === sel ? UI.ink : UI.soft, 13); if (i === sel) cursor(x + 14, oy + 2); });
  if (summary) { let line = summary; while (txtW(line, 10) > w - 46) line = line.slice(0, -2) + '…'; txt(line, x + 29, y + 32, UI.soft, 10, 'left', false); }
  if (hint) txt(hint, x + 16, y + h - 22, UI.soft, 10, 'left', false);
  return { x, y, w, h };
}
// the theme's accent mark (e.g. a vermilion seal): the cursor, the "more" marker and small accents
function uiMark(x, y, r = 4.5, a = 1) { themeUI('mark')(x, y, r, a); }
function cursor(x, y) { const bob = Math.sin(frame / 7) * 1.2; uiMark(x + bob + 2, y + 6, 4); }
// "press to continue": a small mark that breathes
function moreMark(x, y) { uiMark(x, y + Math.sin(frame / 6) * 1.2, 3.2, 0.85 + Math.sin(frame / 6) * 0.15); }
function uiBubble(x, y, glyph) { themeUI('bubble')(x, y, glyph); }                                  // a hint bubble ('?', '…', '◆') over the hero
function uiBanner(text, cx, y, a = 1, size = 16) { themeUI('banner')(text, cx, y, a, size); }       // a band across the screen (area names, round titles)
function gauge(x, y, w, v, max, col, h = 4) { themeUI('gauge')(x, y, w, v, max, col, h); }           // a bar (HP, Ki)
// a decorative stroke on canvas g in canvas px (a rule under a title, an enso's arc): the theme's brush
function uiStroke(g, ax, ay, bx, by, wd, R, col, alpha = 1, dry = 1) { themeUI('stroke')(g, ax, ay, bx, by, wd, R, col, alpha, dry); }
function shadeHex(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255); return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }

// ---------------- Save ----------------
const SAVE_KEY = window.GAME_SAVE_KEY || GAME.saveKey;   // hosted review tools use separate slots (build_site.py sets GAME_SAVE_KEY)
function writeSave(data) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
// job fw-F3b: only a save of the current version (SAVE_VERSION, 01c_save.js) is offered; there is no migration from older ones
function readSave() { try { const s = localStorage.getItem(SAVE_KEY), d = s ? JSON.parse(s) : null; return d && d.v === SAVE_VERSION ? d : null; } catch (e) { return null; } }

// ---- generated image assets (embedded as data URIs by build.py; procedural art is the fallback) ----
const IMG = {};
function assetImg(name) { return IMG[name] || (GAME.standIn ? standInImage(name) : null); }   // job fw-F5a: a game with game.json standIn gets marked stand-ins for what has no file (01e_standin.js)
function loadAssets() {
  const src = typeof ASSET_SRC === 'object' ? ASSET_SRC : {};
  return Promise.all(Object.keys(src).map(k => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { (window.ASSET_FAIL = window.ASSET_FAIL || []).push(k); res(); }; im.src = src[k]; })));
}
