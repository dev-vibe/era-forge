// ============================================================
//  The minigame shell, the rhythm core, and the timing / posture helpers (Job 16a, 24 Oct 2026)
//  Design: the minigames design doc in claude/, section 1. Every minigame (a forge, a sumo bout, a tea contest, rice planting,
//  cormorant fishing, archery, a dice den, joinery, the soroban) is a client of this file, and so is a festival dance.
//
//  THE SHELL. A minigame is registered once:   MINI.<kind> = { state?, start(M, opt), update(M), draw(M), drawUI(M) }
//    startMini(kind, opt)  saves G.state and the music, sets G.state = def.state || 'mini', calls def.start(M, opt) and returns M.
//                          M = { kind, def, opt, f (frames since start), result, resF, prevState, prevMusic, onDone }.
//    08_main.js calls miniUpdate() / drawMini() (the world, on L) / drawMiniUI() (the UI, on X) while G.state is 'mini' or 'dance'.
//    miniResult(M, card)   ends play and shows the washi result card (below); Z / A on the card puts back the previous G.state and
//                          music and calls opt.onDone(card.value). def.update keeps running under the card (sparks fade, people settle).
//    card = { kicker, rank, stats: [[label, value], ...] (up to 3), side: [line, line] (small, right), line: { speaker, portrait, text },
//             value (what onDone gets) }
//  Rules every client keeps (doc section 0): it feeds something, it can't block the story, it pays out once, it is short, and every
//  timed input honours the Timing aid setting (07c_settings.js).
//
//  THE RHYTHM CORE. A chart player for any timing game on a beat: rhythmInit(R, { notes, keys?, win?, onJudge?, onCue? }) adds its fields
//  to the object R (so a client's state object IS the rhythm state: R.notes, R.counts, R.combo, R.best, R.score, R.t, R.clock).
//    notes: [{ t (seconds into the chart), key ('left' | 'up' | 'down' | 'right' | 'a'), cue?, ...anything the client wants }]
//    A note with cue: true is a CALL: it is not judged; when its time comes the core calls onCue(n) (the client sounds and shows it).
//    The other notes are answers, judged Great / Good / Miss on the time the key went down (stamped by the key event itself, so the
//    frame rate never shifts a beat). rhythmStart(R, music?) starts the clock: the audio clock when the music plays, performance time
//    otherwise, and the FRAME clock on a test page (window.TEST_CLOCK), so a rhythm test runs as fast as any other.
//    rhythmStep(R, t?) once a frame (t: the time the client already read this frame): cues, presses, beats that slid past. Timing aid: Wide widens the windows; Auto plays a beat you let
//    pass as a Good (a Great still needs your own press). A stray press between beats costs nothing.
//
//  THE TIMING RING (press / release on a glint; the battle uses the same code, 07_battle.js startTiming / timingInput / grade):
//    tm = tmNew('press' | 'release', now, lead)   (now and lead in ticks, 60 a second)
//    tmInput(tm, now) every tick; tmPoll(tm, now) is true once the press is settled; tmGrade(tm) -> 'perfect' | 'good' | 'none'.
//  POSTURE (kuzushi) outside battle, with the battle's rules: hits crack it; at zero it is Broken; a broken bar comes back full at the
//    end of the next round, an unbroken one recovers 1 a round.  postNew(max), postHit(p, n) (true when it breaks), postRound(p).
//
//  MINI.drill is the reference client (and the Minigames test page's drill): call and response, a hold-and-release, and a posture
//  bar, in plain washi UI with no art. Copy its shape for a new minigame.
// ============================================================

// ---------------- the shell ----------------
const MINI = {};
let MG = null;
function startMini(kind, opt = {}) {
  const def = MINI[kind]; if (!def) throw new Error('no minigame: ' + kind);
  // a minigame started while another is still open replaces it, and inherits what to go back to (never 'go back to the minigame')
  const outer = MG; if (outer && outer.def.finish) outer.def.finish(outer);
  const M = { kind, def, opt, f: 0, result: null, resF: 0, prevState: outer ? outer.prevState : G.state, prevMusic: outer ? outer.prevMusic : Music.name, onDone: opt.onDone || null };
  MG = M; window.MG = M;
  G.state = def.state || 'mini';
  def.start(M, opt);
  return M;
}
function miniUpdate() {
  const M = MG; if (!M) return;
  M.f++;
  M.def.update(M);
  if (MG !== M || !M.result) return;
  if (++M.resF > 40 && btn('a')) { sfx('ok'); miniFinish(); }
}
function miniResult(M, card) { M.result = card; M.resF = 0; }
function miniFinish() {
  const M = MG; if (!M) return;
  const v = M.result ? M.result.value : undefined, cb = M.onDone;
  G.state = M.prevState || 'title'; Music.name = null; playMusic(M.prevMusic || null);
  if (M.def.finish) M.def.finish(M);
  MG = null; window.MG = null;
  if (cb) cb(v);
}
function drawMini() { const M = MG; if (!M) { L.fillStyle = '#000'; L.fillRect(0, 0, W, H); return; } M.def.draw(M); }
function drawMiniUI() { const M = MG; if (!M) return; M.def.drawUI(M); if (M.result) drawMiniResult(M); }
// the washi result card (a dance's card, made general)
function drawMiniResult(M) {
  const R = M.result, a = Math.min(1, M.resF / 20);
  X.fillStyle = `rgba(8,6,14,${0.35 * a})`; X.fillRect(0, 0, W * S, H * S);
  X.globalAlpha = a;
  const x = 120, y = 44, w = 400, h = 236;
  win(x, y, w, h);
  if (R.kicker) txt(R.kicker, x + w / 2, y + 14, '#a89c84', 10, 'center');
  txt(R.rank || '', x + w / 2, y + 28, '#f6d890', 24, 'center');
  // three stat columns on the left, the small side lines right-aligned to the card's edge (Ash, 27 Oct: with three stats the side lines printed over the third)
  (R.stats || []).slice(0, 3).forEach(([k, v], i) => { const sx = x + 30 + i * 96; txt(k, sx, y + 66, '#8a7e66', 10); txt(String(v), sx, y + 78, '#fff', 16); });
  // side lines that fit beside the stats go there (two at most); the rest go along the bottom, under the speaker's words
  const side = R.side || [], st = (R.stats || []).slice(0, 3), lastSt = st[st.length - 1];
  const statsEnd = st.length ? x + 30 + (st.length - 1) * 96 + Math.max(txtW(lastSt[0], 10), txtW(String(lastSt[1]), 16)) + 18 : x + 30, room = x + w - 26 - statsEnd;
  const right = [], below = [];
  for (const l of side) (right.length < 2 && !below.length && txtW(l, 10) <= room ? right : below).push(l);
  right.forEach((l, i) => txt(l, x + w - 26, y + 66 + i * 16, '#c8b890', 10, 'right'));
  let textEnd = y + 120;
  X.fillStyle = 'rgba(42,32,24,.25)'; X.fillRect((x + 24) * S, (y + 106) * S, (w - 48) * S, S);
  const ln = R.line;
  if (ln) {
    const pimg = ln.portrait && assetImg('portrait_' + ln.portrait);
    if (pimg) { X.imageSmoothingEnabled = false; X.drawImage(pimg, (x + 24) * S, (y + 118) * S, 72 * S, 72 * S); }
    const tx = x + (pimg ? 108 : 28);
    if (ln.speaker) { win(tx, y + 114, txtW(ln.speaker, 11, true) + 26, 17, 1); txt(ln.speaker, tx + 11, y + 116, '#f6d890', 11); }   // measured in the bold face it is drawn in (main), a little room for the brush's ragged end
    const ls = wrap(ln.speaker ? '"' + ln.text + '"' : ln.text, w - (tx - x) - 24, 11);
    ls.forEach((l, i) => txt(l, tx, y + (ln.speaker ? 138 : 120) + i * 15, '#f4ecd8', 11));
    textEnd = y + (ln.speaker ? 138 : 120) + ls.length * 15;
  }
  if (below.length) {
    const sx = x + (ln && ln.portrait && assetImg('portrait_' + ln.portrait) ? 108 : 28), sy = Math.max(textEnd + 4, y + h - 34 - below.length * 12);
    below.slice(0, 3).forEach((l, i) => txt(l, sx, sy + i * 12, '#a89c84', 9));
  }
  if (M.resF > 40) { txt('{a} Continue', x + w - 24, y + h - 22, '#a89c84', 10, 'right'); moreMark(x + w - 14, y + h - 18); }
  X.globalAlpha = 1;
}

// ---------------- the rhythm core ----------------
const RHYTHM_KEYS = ['left', 'up', 'down', 'right', 'a'];
const RHYTHM_WIN = { great: 0.09, good: 0.18, late: 0.22 };   // seconds either side of a beat: the festival dance's windows (Ash, 10 Oct 2026: 'too strict', widened)
const RHYTHM_WIDE = 1.4;                                       // Timing aid 'Wide' scales every window by this
let RHY = null;   // the chart being played (key presses are stamped into it)
function rhythmInit(R, o = {}) {
  Object.assign(R, {
    notes: o.notes || [], keys: o.keys || RHYTHM_KEYS, win: o.win || RHYTHM_WIN, onJudge: o.onJudge || null, onCue: o.onCue || null,
    clock: 'perf', t0: 0, t: -1, playing: false, inq: [], score: 0, combo: 0, best: 0, counts: { great: 0, good: 0, miss: 0 },
  });
  RHY = R;
  return R;
}
function rhythmWin(R) { const w = R.win || RHYTHM_WIN; if (cfg().aid !== 'wide') return w; return { great: w.great * RHYTHM_WIDE, good: w.good * RHYTHM_WIDE, late: w.late * RHYTHM_WIDE }; }
// start the clock: the audio clock when `music` can play (so the beats you see are the beats you hear), else performance time; on a test page the frame clock
function rhythmStart(R, music) {
  if (window.TEST_CLOCK) { R.clock = 'frame'; R.t0 = frame / 60 + 0.08; }
  else if (music && Snd.ctx && Snd.ctx.state === 'running' && Snd.on) { Music.name = null; playMusic(music); R.clock = 'audio'; R.t0 = Music.mode === 'file' ? Music.fileT0 : Music.next; }   // a music file: its own 0 s (Job 16c)
  else { R.clock = 'perf'; R.t0 = performance.now() / 1000 + 0.08; }
  R.playing = true; RHY = R;
}
function rhythmTime(R) {
  if (!R || !R.playing) return -1;
  if (R.clock === 'audio' && Snd.ctx) { const lat = Math.min(0.1, (Snd.ctx.outputLatency || 0) + (Snd.ctx.baseLatency || 0)); return Snd.ctx.currentTime - R.t0 - lat; }
  if (R.clock === 'frame') return frame / 60 - R.t0;
  return performance.now() / 1000 - R.t0;
}
// presses are stamped with the chart's time the moment they happen (keyboard and the touch pad), so the frame rate never shifts a beat
function rhythmStamp(k) { const R = RHY; if (R && R.playing && !R.over && R.keys.includes(k) && !Input.down[k]) R.inq.push({ k, t: rhythmTime(R) }); }
window.addEventListener('keydown', e => { if (!e.repeat) rhythmStamp(KEYMAP[e.code]); }, true);
document.querySelectorAll('.pad button').forEach(b => b.addEventListener('pointerdown', () => rhythmStamp(b.dataset.k), true));
function rhythmStep(R, tNow) {
  const t = R.t = tNow != null ? tNow : rhythmTime(R), w = rhythmWin(R), auto = timingAuto();
  for (const n of R.notes) { if (!n.cue || n.res) continue; if (t >= n.t) { n.res = 'cue'; if (R.onCue) R.onCue(n); } else break; }
  const presses = R.inq.splice(0); for (const k of R.keys) if (btn(k) && !presses.some(p => p.k === k)) presses.push({ k, t });
  for (const { k, t: tp } of presses) {
    const n = R.notes.find(n => !n.res && !n.cue && Math.abs(tp - n.t) <= w.late);
    if (!n) continue;                                             // a stray press between beats costs nothing
    const dt = Math.abs(tp - n.t);
    rhythmJudge(R, n, n.key !== k ? 'miss' : dt <= w.great ? 'great' : dt <= w.good ? 'good' : 'miss', k);
  }
  // beats that slid past unplayed (Timing aid 'Auto' plays them as a Good)
  for (const n of R.notes) { if (n.res || n.cue) continue; if (t - n.t > w.late) rhythmJudge(R, n, auto ? 'good' : 'miss', auto ? n.key : undefined); else break; }
  return t;
}
function rhythmJudge(R, n, res, key) {
  n.res = res;
  if (res === 'miss') { R.combo = 0; R.counts.miss++; }
  else { R.combo++; R.best = Math.max(R.best, R.combo); R.counts[res]++; R.score += Math.round((res === 'great' ? 100 : 50) * (1 + Math.min(R.combo, 50) / 50)); }
  if (R.onJudge) R.onJudge(n, res, key);
}
const rhythmAnswers = R => R.notes.filter(n => !n.cue);
function rhythmAccuracy(R) { const c = R.counts, n = rhythmAnswers(R).length || 1; return (c.great + c.good * 0.6) / n; }
function rhythmDone(R, end) { return R.t > end && R.notes.every(n => n.res); }
function rhythmStop(R) { R.over = true; if (RHY === R) RHY = null; }

// ---------------- the timing ring (shared with the battle) ----------------
// tm = { kind: 'press' | 'release', at: tick of contact, from: tick the ring starts, res: null | 'perfect' | 'good' | 'early' | 'late' | 'none', holding, glinted }
function tmNew(kind, now, lead) { return { kind, at: now + lead, from: now, res: null, holding: false, glinted: false }; }
function gradeOf(d, w) { return d >= -w.p[0] && d <= w.p[1] ? 'perfect' : d >= -w.g[0] && d <= w.g[1] ? 'good' : d < -w.g[0] ? 'early' : 'late'; }
function tmInput(tm, now) {
  if (!tm || tm.res) return;
  const w = timingWin(), d = now - tm.at;
  if (tm.kind === 'release') {
    if (!tm.holding && held('a') && d < -w.g[0]) tm.holding = true;
    if (tm.holding && !held('a')) tm.res = gradeOf(d, w);
    return;
  }
  if (btn('a')) tm.res = gradeOf(d, w);
}
// true once the press is settled (graded, or the window has closed); a release ring glints (sfx) when its moment comes
function tmPoll(tm, now) {
  if (!tm) return true;
  const w = timingWin();
  if (tm.kind === 'release' && !tm.glinted && now >= tm.at) { tm.glinted = true; sfx('ok'); }
  if (tm.res === 'perfect' || tm.res === 'good' || tm.res === 'late') return true;
  if (tm.res === 'early') return tm.kind === 'release' ? true : now >= tm.at;
  if (now >= tm.at + w.g[1]) { tm.res = tm.holding ? 'late' : 'none'; return true; }
  return false;
}
function tmGrade(tm) {
  if (!tm) return 'none';
  let g = tm.res === 'perfect' || tm.res === 'good' ? tm.res : 'none';
  if (g === 'none' && timingAuto()) g = 'good';
  return g;
}
// how far the ink ring has closed, 0 (just opened) to 1 (contact)
function tmClose(tm, now) { return tm ? clamp((now - tm.from) / Math.max(1, tm.at - tm.from), 0, 1) : 0; }

// ---------------- posture outside battle (the battle's rules, 07_battle.js) ----------------
function postNew(max) { return { post: max, postMax: max, broken: false }; }
function postHit(p, n) { if (p.broken) return false; p.post = Math.max(0, p.post - n); if (p.post === 0) { p.broken = true; return true; } return false; }
function postRound(p) { if (p.broken) { p.broken = false; p.post = p.postMax; } else p.post = Math.min(p.postMax, p.post + 1); }

// ---------------- MINI.drill: the reference client ----------------
// opt.part: 'call' (call and response on the rhythm core), 'hold' (three hold-and-release draws), 'push' (crack a posture bar with
// timed presses); without opt.part all three in a row. Plain washi UI; the world is the well square at dusk (or black).
const DRILL_BPM = 96;
function drillCallChart() {
  // four bars of 4/4 at 96 bpm: the caller taps on beats 1 and 2, you answer on 3 and 4, same keys, in a growing pattern
  const beat = 60 / DRILL_BPM, pat = [['a', 'a'], ['left', 'right'], ['up', 'a'], ['right', 'left'], ['a', 'down'], ['left', 'a']], notes = [];
  pat.forEach((p, bar) => {
    const t0 = 1.2 + bar * beat * 4;
    p.forEach((k, i) => notes.push({ t: t0 + i * beat, key: k, cue: true }));
    p.forEach((k, i) => notes.push({ t: t0 + (2 + i) * beat, key: k }));
  });
  return notes;
}
MINI.drill = {
  start(M, opt) {
    M.parts = opt.part ? [opt.part] : ['call', 'hold', 'push']; M.pi = -1; M.log = {}; M.pops = [];
    playMusic(null);
    drillNext(M);
  },
  update(M) {
    M.pops.forEach(p => p.f++); M.pops = M.pops.filter(p => p.f < 40);
    if (M.result) return;
    const P = M.part; if (!P) return;
    P.f++;
    if (P.kind === 'call') {
      if (P.phase === 'intro') { if (P.f > 20 && btn('a')) { audioInit(); P.phase = 'play'; rhythmStart(P); } return; }
      rhythmStep(P);
      if (rhythmDone(P, P.end)) { rhythmStop(P); M.log.call = { acc: rhythmAccuracy(P), counts: Object.assign({}, P.counts), best: P.best, score: P.score }; drillNext(M); }
    } else if (P.kind === 'hold') {
      P.tick++;
      if (!P.tm) { if (P.wait-- <= 0) P.tm = tmNew('release', P.tick, P.lead[P.n]); return; }
      tmInput(P.tm, P.tick);
      if (tmPoll(P.tm, P.tick)) {
        const g = tmGrade(P.tm); P.res.push(g === 'none' && P.tm.res === 'early' ? 'early' : g);
        M.pops.push({ text: g === 'perfect' ? 'Clean draw!' : g === 'good' ? 'Good' : P.tm.res === 'early' ? 'Too soon' : 'Too late', f: 0, good: g !== 'none' });
        P.tm = null; P.n++; P.wait = 50;
        if (P.n >= P.lead.length) { M.log.hold = P.res.slice(); drillNext(M); }
      }
    } else if (P.kind === 'push') {
      P.tick++;
      if (!P.tm) { if (P.wait-- <= 0) P.tm = tmNew('press', P.tick, 46); return; }
      tmInput(P.tm, P.tick);
      if (tmPoll(P.tm, P.tick)) {
        const g = tmGrade(P.tm), dmg = g === 'perfect' ? 3 : g === 'good' ? 2 : 0;
        if (dmg && postHit(P.p, dmg)) { P.breaks++; sfx('crit'); M.pops.push({ text: 'Broken!', f: 0, good: true }); }
        else M.pops.push({ text: g === 'perfect' ? 'Perfect' : g === 'good' ? 'Good' : 'Missed', f: 0, good: !!dmg });
        P.tm = null; P.n++; P.wait = 30;
        if (P.n % 3 === 0) postRound(P.p);    // a 'round' every three presses
        if (P.n >= 9) { M.log.push = { breaks: P.breaks }; drillNext(M); }
      }
    }
  },
  draw(M) {
    L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
    const bgName = GAME.minigames && GAME.minigames.drillBg, img = bgName && assetImg(bgName);
    if (img) { L.drawImage(img, 0, 0, W, H); L.fillStyle = 'rgba(20,16,40,.55)'; L.fillRect(0, 0, W, H); } else { L.fillStyle = '#1a1420'; L.fillRect(0, 0, W, H); }
  },
  drawUI(M) {
    const P = M.part;
    if (P && !M.result) {
      win(150, 20, 340, 40); txt(P.title, 320, 26, '#f6d890', 13, 'center'); txt(P.hint, 320, 43, '#f4ecd8', 9, 'center');
      if (P.kind === 'call') drillDrawCall(P);
      else if (P.kind === 'hold') drillDrawRing(P, `Hold ${keyName('a')}, let go on the glint`);
      else if (P.kind === 'push') { drillDrawRing(P, `Press ${keyName('a')} as the ring closes`); drillDrawPosture(P.p); }
    }
    for (const p of M.pops) { X.globalAlpha = clamp(1 - p.f / 40, 0, 1); headTxt(p.text, 320, 120 - p.f * 0.5, p.good ? '#ffcf8a' : '#a8a0b0', 15, 'center', 800, 'rgba(0,0,0,.85)'); X.globalAlpha = 1; }
  },
};
function drillNext(M) {
  M.pi++;
  const kind = M.parts[M.pi];
  if (!kind) { M.part = null; drillResultCard(M); return; }
  if (kind === 'call') {
    const P = rhythmInit({ kind, f: 0, phase: 'intro', title: 'Call and response', hint: 'Two taps call; answer them with the same keys on the next two beats.' }, {
      notes: drillCallChart(),
      onCue: () => { const c = Snd.ctx; if (c && Snd.on) note(1320, c.currentTime + 0.005, 0.06, 'triangle', 0.14); },
      onJudge: (n, res) => { const c = Snd.ctx; if (c && Snd.on) { const t = c.currentTime + 0.005; if (res === 'miss') note(150, t, 0.08, 'square', 0.08); else noiseHit(t, 0.05, res === 'great' ? 0.3 : 0.24, res === 'great' ? 4200 : 3000); } M.pops.push({ text: res === 'great' ? 'Great!' : res === 'good' ? 'Good' : 'Miss', f: 0, good: res !== 'miss' }); },
    });
    P.end = P.notes[P.notes.length - 1].t + 0.8;
    M.part = P;
  } else if (kind === 'hold') M.part = { kind, f: 0, tick: 0, title: 'Hold and release', hint: (GAME.minigames && GAME.minigames.holdHint) || 'Hold, and let go when it glints.', lead: [70, 110, 55], n: 0, res: [], wait: 30, tm: null };
  else if (kind === 'push') M.part = { kind, f: 0, tick: 0, title: 'Posture', hint: 'Timed presses crack the bar; at zero it breaks, then comes back full.', p: postNew(6), n: 0, breaks: 0, wait: 30, tm: null };
}
function drillResultCard(M) {
  const L_ = M.log, stats = [], side = [];
  if (L_.call) { stats.push(['In time', Math.round(L_.call.acc * 100) + '%']); side.push(`Great ${L_.call.counts.great}   Good ${L_.call.counts.good}   Miss ${L_.call.counts.miss}`); }
  if (L_.hold) { stats.push(['Clean draws', L_.hold.filter(g => g === 'perfect').length + ' / ' + L_.hold.length]); side.push('Draws: ' + L_.hold.join(', ')); }
  if (L_.push) stats.push(['Breaks', L_.push.breaks]);
  const acc = L_.call ? L_.call.acc : 1;
  miniResult(M, { kicker: 'The drill ends', rank: acc >= 0.9 ? 'Sharp' : acc >= 0.6 ? 'Steady' : 'Willing', stats, side,
    line: { text: 'A practice drill for the minigame engine (Job 16a). Every minigame in Job 16 is built on these three pieces.' }, value: L_ });
}
// ---------------- the rhythm lane (shared by the dance, the forge and the drill) ----------------
// the lane's layout, and its note and hit ring: the theme draws the note and the ring (widgets rhythmNote and rhythmRing, 01a_game.js)
const RHYTHM_LANE = { x: 14, y: 300, w: 612, h: 48, hit: 66 };
const drawRhythmNote = (key, x, y, r, a = 1) => themeUI('rhythmNote')(key, x, y, r, a);
const drawRhythmRing = (x, y, glow, res) => themeUI('rhythmRing')(x, y, glow, res);
function drillDrawCall(P) {
  const Ln = RHYTHM_LANE, ly = Ln.y + Ln.h / 2, t = P.t, lead = 2.2;
  win(Ln.x, Ln.y, Ln.w, Ln.h);
  if (P.phase === 'intro') { txt('{a} Begin', 320, 260, '#fff', 12, 'center'); drawRhythmRing(Ln.hit, ly, 0); return; }
  X.fillStyle = 'rgba(42,32,24,.25)'; X.fillRect(Ln.hit * S, (ly - 0.5) * S, (Ln.x + Ln.w - 12 - Ln.hit) * S, S);
  drawRhythmRing(Ln.hit, ly, 0);
  for (let i = P.notes.length - 1; i >= 0; i--) {
    const n = P.notes[i]; if (n.res && n.res !== 'miss' && !n.cue) continue;
    const x = Ln.hit + (n.t - t) / lead * (Ln.w - 70);
    if (x > Ln.x + Ln.w - 10 || x < Ln.x + 4) continue;
    if (n.cue) drawRhythmNote(n.key, x, ly - 1, 8, n.res ? 0.25 : 0.6);   // the call: small and faint, it plays itself
    else drawRhythmNote(n.key, x, ly, 13, n.res === 'miss' ? 0.35 : 1);
  }
  txt(`Score ${P.score}   Combo ${P.combo}`, 320, 280, '#f4ecd8', 10, 'center');
}
function drillDrawRing(P, label) {
  const cx = 320, cy = 190;
  win(220, 120, 200, 140);
  txt(label, cx, 238, '#f4ecd8', 10, 'center');
  X.save(); X.translate(cx * S, cy * S);
  X.strokeStyle = UI.seal; X.lineWidth = 2.2 * S; X.beginPath(); X.arc(0, 0, 14 * S, 0, 7); X.stroke();
  if (P.tm) {
    const k = tmClose(P.tm, P.tick);
    if (timingRing()) { X.strokeStyle = 'rgba(42,32,24,.7)'; X.lineWidth = 1.5 * S; X.beginPath(); X.arc(0, 0, (14 + (1 - k) * 46) * S, 0, 7); X.stroke(); }
    if (P.tm.kind === 'release' && P.tm.glinted && P.tick - P.tm.at < 14) { X.fillStyle = 'rgba(255,240,200,.9)'; X.beginPath(); X.arc(0, 0, 9 * S, 0, 7); X.fill(); }
    if (P.tm.holding) { X.fillStyle = 'rgba(181,48,28,.35)'; X.beginPath(); X.arc(0, 0, 11 * S, 0, 7); X.fill(); }
  }
  X.restore();
}
function drillDrawPosture(p) {
  const x = 250, y = 100, w = 140;
  txt(p.broken ? 'Broken' : 'Posture', x, y - 12, p.broken ? '#e07050' : '#c8b890', 9);
  X.fillStyle = 'rgba(20,14,10,.6)'; X.fillRect(x * S, y * S, w * S, 5 * S);
  X.fillStyle = p.broken ? '#e07050' : '#e8c070'; X.fillRect(x * S, y * S, (w * p.post / p.postMax) * S, 5 * S);
}
// test page: window.MINI_TEST = 'drill' (or 'drill:call' ...) boots straight into a minigame (make_mini_page.py)
function miniTestBoot(spec) {
  G.f = {}; G.hero = newHero(); G.allies = {}; G.active = []; G.inv = {}; G.state = 'title';
  const [kind, part] = String(spec).split(':');
  const go = () => startMini(kind, { part, onDone: v => { window.MINI_RESULT = v; window.MINI_RUNS = (window.MINI_RUNS || 0) + 1; go(); } });
  go();
}

// Job fw-F2: the minigame kit's modes ('dance' is the festival dance's own state name, same shell)
for (const id of ['mini', 'dance']) defineMode(id, { kit: 'minigame', update: () => miniUpdate(), art: () => drawMini(), ui: () => drawMiniUI() });
