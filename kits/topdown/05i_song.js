// ============================================================
//  Job 8g-r3: notes rising over a singer
// ============================================================
// While a song plays (playSong in 01_core.js, started by the story step { song, singer }), little music notes in art pixels
// (an eighth note and a beamed pair, washi cream with a dark ink outline and a faint warm glow) rise from above the singer's
// head, sway and fade. They are drawn after the scene's night grade and lighting (drawScene, 05c), so they read in the dark
// by the fire. The singer is a follower or an NPC of the scene, found by id each frame (sitting by the fire or standing);
// no singer found = no notes. When the song ends or is skipped the notes already in the air finish their rise and fade.
const NOTE_ART = {
  eighth: ['...##...', '...#.#..', '...#..#.', '...#..#.', '...#.#..', '...#....', '...#....', '.###....', '####....', '####....', '.##.....'],
  pair: ['...#######', '...#######', '...#.....#', '...#.....#', '...#.....#', '...#.....#', '.###...###', '####..####', '####..####', '.##....##.'],
};
const NOTE_PX = 1;   // logical px per art pixel: chunky like the UI, so they read at a glance (half-size ones were too small: 20 Oct 2026)
const NOTE_LIFE = 170, NOTE_EVERY = [34, 58], NOTE_MAX = 7, NOTE_RISE = 0.24, NOTE_SWAY = 4;
const Notes = { list: [], next: 0, last: 0, scene: null, alt: 0, cache: {} };
// one glyph as a small canvas, 1 canvas px per art pixel: cream fill, a 1-px ink outline round it
function noteSprite(kind) {
  if (Notes.cache[kind]) return Notes.cache[kind];
  const rows = NOTE_ART[kind], w = rows[0].length + 2, h = rows.length + 2, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), on = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] === '#';
  for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) {
    if (on(x, y)) { g.fillStyle = '#f4ecd8'; g.fillRect(x + 1, y + 1, 1, 1); }
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { g.fillStyle = '#2b1c18'; g.fillRect(x + 1, y + 1, 1, 1); }
  }
  return (Notes.cache[kind] = c);
}
const NOTE_TOP = new WeakMap();   // sprite canvas -> its first opaque row (the top of the head)
function noteHead(o) {   // where the singer's head is, in logical px (scene coordinates)
  const hk = scHK(), s = o.sit && typeof sitSprite === 'function' ? sitSprite(o.cast, o.sit) : o.cast ? castSprite(o.cast, o.dir || 0, 0) : null;
  if (!s) return { x: o.x, y: o.y - 34 * hk };
  const q = s.q || 1, ht = s.height / (2 * q) * hk;
  if (!NOTE_TOP.has(s)) NOTE_TOP.set(s, typeof sprRows === 'function' ? sprRows(s)[0] : 0);
  return { x: o.x, y: o.y - ht + 1 + NOTE_TOP.get(s) / (2 * q) * hk };
}
function noteSinger() {
  const id = Song.singer; if (!id || typeof SC !== 'object') return null;
  return (SC.followers || []).find(f => f.id === id && !f.hidden) || (SC.npcs || []).find(n => n.id === id && !n.hidden) || null;
}
function notesStep() {
  if (Notes.scene !== SC.id) { Notes.list = []; Notes.scene = SC.id; }
  const tr = Song.name && contentGet('music', Song.name), from = (tr && tr.notesFrom) || 0;   // notesFrom: seconds into the take where the singing starts
  const o = Song.state === 'playing' && Snd.ctx && Snd.ctx.currentTime - Song.t0 >= from && noteSinger();
  if (o && frame >= Notes.next && Notes.list.length < NOTE_MAX) {
    const hd = noteHead(o), side = (Notes.alt++ % 2 ? 1 : -1);
    Notes.list.push({ x: hd.x + side * rnd(3, 8), y: hd.y - 4, vx: side * rnd(0.02, 0.07), ph: rnd(0, 6.28), t: 0, kind: Math.random() < 0.6 ? 'eighth' : 'pair' });
    Notes.next = frame + Math.round(rnd(NOTE_EVERY[0], NOTE_EVERY[1]));
  }
  for (const n of Notes.list) { n.t++; n.y -= NOTE_RISE * (1 - n.t / NOTE_LIFE * 0.4); n.x += n.vx; }
  Notes.list = Notes.list.filter(n => n.t < NOTE_LIFE);
}
// called from drawScene (05c) after the lighting pass; cx, cy = the camera (scene px at the screen's top-left)
function drawSongNotes(cx, cy) {
  if (typeof Song !== 'object') return;
  const steps = Math.min(4, frame - Notes.last); Notes.last = frame;
  for (let i = 0; i < steps; i++) notesStep();
  if (!Notes.list.length) return;
  for (const n of Notes.list) {
    const s = noteSprite(n.kind), a = Math.min(1, n.t / 18, (NOTE_LIFE - n.t) / 45), w = s.width * NOTE_PX, h = s.height * NOTE_PX;
    const x = Math.round((n.x + Math.sin(n.t / 22 + n.ph) * NOTE_SWAY * Math.min(1, n.t / 40) - cx - w / 2) * 2) / 2, y = Math.round((n.y - cy - h) * 2) / 2;
    L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.28 * a;
    const r = 9; L.drawImage(glowSprite(r, '#ffb060'), x + w / 2 - r, y + h / 2 - r);
    L.globalCompositeOperation = 'source-over'; L.globalAlpha = 0.95 * a;
    L.drawImage(s, x, y, w, h);
  }
  L.globalAlpha = 1;
}

// Job fw-F3a: notes rising over a singer, after the night grade (01a_game.js, 05c SCENE_SLOTS)
defineLayer('top', 'song.notes', { owner: 'kit:topdown', order: 100, fn: (cx, cy) => drawSongNotes(cx, cy) });
