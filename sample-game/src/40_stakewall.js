// ============================================================
//  Cincinnatus — the night stake wall at Algidus (job fw-F6, 29 Oct 2026)
//  Livy 3.28: the army reached Algidus at midnight; every man dug a ditch and drove his twelve stakes where he stood, and the whole army
//  shouted as it worked. A client of the minigame shell and its rhythm core (05a_minigame.js): the line's shout is the CALL (a cue on
//  beat 1); Titus answers on beats 2 to 4: drive a stake (Down), dig (A), drive a stake (Down). Six shouts, twelve stakes.
//  Charter: area 6 (the first result feeds the story, replays are for a best score only), area 5 (no result blocks: a gappy wall lets
//  more Aequi through at the breakout), area 8 (the rhythm core honours the Timing aid). Value: { quality: 'tight' | 'sound' | 'gappy', acc }.
//  The lane is the minigame kit's (RHYTHM_LANE, drawRhythmNote, drawRhythmRing in 05a_minigame.js); the theme draws the notes and the ring.
// ============================================================
const WALL_BPM = 84;
function wallChart() {
  const beat = 60 / WALL_BPM, notes = [];
  for (let bar = 0; bar < 6; bar++) {
    const t0 = 1.6 + bar * beat * 4;
    notes.push({ t: t0, key: 'a', cue: true });                      // the shout
    notes.push({ t: t0 + beat, key: 'down', stake: 1 });             // drive a stake
    notes.push({ t: t0 + beat * 2, key: 'a', dig: 1 });              // a spadeful out of the ditch
    notes.push({ t: t0 + beat * 3, key: 'down', stake: 1 });         // drive a stake
  }
  return notes;
}
const wallQuality = acc => acc >= 0.85 ? 'tight' : acc >= 0.55 ? 'sound' : 'gappy';
MINI.stakewall = {
  start(M, opt) {
    M.replay = !!opt.replay; M.pops = []; M.stakes = 0; M.ditch = 0; M.alarm = 0; M.shout = 0;
    playMusic(null);
    M.R = rhythmInit({ phase: 'intro', f: 0 }, {
      notes: wallChart(),
      onCue: () => { M.shout = 30; const c = Snd.ctx; if (c && Snd.on) { noiseHit(c.currentTime + 0.005, 0.25, 0.35, 300); note(110, c.currentTime + 0.005, 0.3, 'sawtooth', 0.12); } },
      onJudge: (n, res) => {
        const ok = res !== 'miss';
        if (ok && n.stake) M.stakes++;
        if (ok && n.dig) M.ditch++;
        if (!ok) M.alarm = Math.min(6, M.alarm + 1);
        const c = Snd.ctx; if (c && Snd.on) { const t = c.currentTime + 0.005; if (!ok) note(140, t, 0.08, 'square', 0.08); else noiseHit(t, 0.06, 0.3, n.stake ? 900 : 2400); }
        M.pops.push({ text: !ok ? 'Missed' : n.stake ? (res === 'great' ? 'Stake driven!' : 'Stake') : (res === 'great' ? 'Deep cut!' : 'Dig'), f: 0, good: ok });
      },
    });
    M.R.end = M.R.notes[M.R.notes.length - 1].t + 0.8;
  },
  update(M) {
    M.pops.forEach(p => p.f++); M.pops = M.pops.filter(p => p.f < 40); if (M.shout > 0) M.shout--;
    if (M.result) return;
    const R = M.R; R.f++;
    if (R.phase === 'intro') { if (R.f > 20 && btn('a')) { audioInit(); R.phase = 'play'; rhythmStart(R); } return; }
    rhythmStep(R);
    if (rhythmDone(R, R.end)) { rhythmStop(R); wallResult(M); }
  },
  draw(M) {
    // the ring at midnight: a dark slope, the Aequi fires beyond, the ditch and the stakes Titus has driven
    const bg = assetImg('bg_battle_algidus');   // the night at Algidus (the battle's backdrop), darker: the ring is still being dug
    if (bg) { L.drawImage(bg, 0, 0, W, H); L.fillStyle = 'rgba(6,8,18,.55)'; L.fillRect(0, 0, W, H); }
    else {
      L.fillStyle = '#0c101c'; L.fillRect(0, 0, W, H);
      L.fillStyle = '#161c16'; L.beginPath(); L.moveTo(0, 150); for (let x = 0; x <= W; x += 40) L.lineTo(x, 120 + Math.sin(x / 90) * 18); L.lineTo(W, H); L.lineTo(0, H); L.fill();
      L.fillStyle = '#2a2418'; L.fillRect(0, 250, W, 110);
    }
    for (const x of [90, 300, 520]) { const a = 0.35 + 0.1 * Math.sin(frame / 7 + x); L.fillStyle = `rgba(255,150,60,${a})`; L.fillRect(x, 128, 4, 3); }
    L.fillStyle = '#120e0a'; L.fillRect(60, 214, 520, 4 + M.ditch);                  // the ditch deepens
    for (let i = 0; i < 12; i++) { const x = 70 + i * 43; if (i < M.stakes) { L.fillStyle = '#7a6040'; L.fillRect(x, 172, 6, 42); L.fillStyle = '#9a7a52'; L.fillRect(x, 170, 6, 3); } else { L.fillStyle = 'rgba(122,96,64,.25)'; L.fillRect(x, 202, 6, 12); } }
    if (M.shout > 0) { L.fillStyle = `rgba(255,220,160,${M.shout / 120})`; L.fillRect(0, 0, W, H); }
  },
  drawUI(M) {
    const R = M.R;
    if (!M.result) {
      win(150, 16, 340, 42); txt(M.replay ? 'The stake wall (practice)' : 'The stake wall at Algidus', 320, 22, '#f6d890', 13, 'center');
      txt(`The line shouts; answer:  ${keyName('down')} drive a stake,  ${keyName('a')} dig,  ${keyName('down')} drive a stake.`, 320, 40, '#f4ecd8', 9, 'center');
      wallLane(R);
      txt(`Stakes ${M.stakes} / 12`, 170, 274, '#f4ecd8', 10); txt('The Aequi stir', 470, 274, M.alarm >= 4 ? '#e07050' : '#c8b890', 10, 'right');
      X.fillStyle = 'rgba(20,14,10,.6)'; X.fillRect(480 * S, 276 * S, 60 * S, 5 * S); X.fillStyle = '#e07050'; X.fillRect(480 * S, 276 * S, (60 * M.alarm / 6) * S, 5 * S);
    }
    for (const p of M.pops) { X.globalAlpha = clamp(1 - p.f / 40, 0, 1); headTxt(p.text, 320, 120 - p.f * 0.5, p.good ? '#ffcf8a' : '#a8a0b0', 15, 'center', 800, 'rgba(0,0,0,.85)'); X.globalAlpha = 1; }
  },
};
function wallLane(R) {
  const Ln = RHYTHM_LANE, ly = Ln.y + Ln.h / 2, lead = 2.4;
  win(Ln.x, Ln.y, Ln.w, Ln.h);
  if (R.phase === 'intro') { txt(`${keyName('a')}  Begin`, 320, Ln.y - 22, '#fff', 12, 'center'); drawRhythmRing(Ln.hit, ly, 0); return; }
  drawRhythmRing(Ln.hit, ly, 0);
  for (let i = R.notes.length - 1; i >= 0; i--) {
    const n = R.notes[i]; if (n.res && n.res !== 'miss' && !n.cue) continue;
    const x = Ln.hit + (n.t - R.t) / lead * (Ln.w - 70); if (x > Ln.x + Ln.w - 10 || x < Ln.x + 4) continue;
    if (n.cue) drawRhythmNote(n.key, x, ly - 1, 8, n.res ? 0.25 : 0.6);   // the shout: small and faint, it plays itself
    else drawRhythmNote(n.key, x, ly, 13, n.res === 'miss' ? 0.35 : 1);
  }
}
function wallResult(M) {
  const R = M.R, acc = rhythmAccuracy(R), q = wallQuality(acc), best = Math.max(G.f.cin_wall_best || 0, R.score);
  if (M.replay) G.f.cin_wall_best = best;
  const rank = { tight: 'A tight wall', sound: 'A sound wall', gappy: 'A gappy wall' }[q];
  const line = M.replay ? { text: `Practice only: the score is kept, nothing else changes. Best ${best}.` }
    : { speaker: 'Cincinnatus', portrait: 'cincinnatus_50', text: q === 'tight' ? 'Shoulder to shoulder, and not a gap a dog could crawl through. Good.' : q === 'sound' ? 'It will hold. Mostly.' : 'There are holes in it. Then we stand in the holes.' };
  miniResult(M, { kicker: M.replay ? 'Practice' : 'Midnight, Mount Algidus', rank, stats: [['Stakes', M.stakes + ' / 12'], ['In time', Math.round(acc * 100) + '%'], ['Score', R.score]],
    side: [`Great ${R.counts.great}   Good ${R.counts.good}   Miss ${R.counts.miss}`], line, value: { quality: q, acc, score: R.score } });
}
