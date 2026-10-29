// ============================================================
//  Sleep fades (Job 8g-r5, 19 Oct 2026)
//  Every sleep in the game fades to dark and back: the inn, a hearth, a camp and the end of a supper
//  (and the old tile maps' hearth and inn). The screen fades to black, holds there a moment while the music ducks and a
//  quiet night bed plays (insects; the cave's own drips at the camp), then the rest itself happens (restore, save at the inn)
//  and the screen fades back in on the 'HP and Ki restored' line, which opens while the light returns.
//  Script step: sleepFade(place, fn) -> { sleep: place, then: fn } (the `sleep` story step, order 1040, registered at the end of this file, calls sleepStart).
//  The black is drawn by drawSleep() (08_main.js render, under the dialog box so the line stays readable), eased by
//  sleepTick() (08_main.js update). Night bed: sceneAmb() (01_core.js) plays SLEEP.amb while it is set.
// ============================================================
const SLEEP_T = { out: 40, hold: 120, in: 40 };   // frames at 60 fps: about 0.7 s down, 2 s in the dark, 0.7 s back (shortened a tad, Ash 20 Oct 2026)
const SLEEP_DUCK = 0.2;                            // the music sits at this share of its level while it is dark
const SLEEP = { ph: null, a: 0, t: 0, amb: null, then: null, place: null, count: 0, log: [] };
// the script step for one night's sleep; fn runs in the dark at the end of the hold (restore, save)
function sleepFade(place, fn) { return { sleep: place, then: fn || null }; }
function sleepMusic(k) {
  const c = Snd.ctx, g = Snd.musicGain; if (!c || !g) return;
  const t = c.currentTime, to = 0.55 * k;
  try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(to, t + 0.8); } catch (e) {}
}
function sleepStart(s) {
  Object.assign(SLEEP, { ph: 'out', t: 0, then: s.then || null, place: s.sleep, amb: null });
  if (typeof ST === 'object') {   // hold the evening where it is (the dim, Job 8g-r1's night grade and fire); it is cleared once the screen is black
    ST.dimTo = ST.dim; if (ST.nightTo != null) ST.nightTo = ST.night; if (ST.fire) ST.fireTo = ST.fireA;
  }
  sleepMusic(SLEEP_DUCK);
  return 'wait';
}
function sleepEnd() { SLEEP.ph = null; SLEEP.amb = null; SLEEP.then = null; sleepMusic(1); }
function sleepTick() {
  if (!SLEEP.ph) return;
  if (SLEEP.ph !== 'in' && !Script.active) { SLEEP.a = 0; sleepEnd(); return; }   // the script was dropped (a test jump, a reset)
  SLEEP.t++;
  if (SLEEP.ph === 'out') {
    SLEEP.a = Math.min(1, SLEEP.t / SLEEP_T.out);
    if (SLEEP.a >= 1) {
      SLEEP.ph = 'hold'; SLEEP.t = 0;
      if (typeof ST === 'object') { ST.dim = ST.dimTo = 0; ST.night = ST.nightTo = 0; ST.fire = null; ST.fireA = ST.fireTo = 0; ST.sparks = []; }   // morning: no dim, no night grade, the fire out
      SLEEP.amb = (content('ambience').sleep || {})[SLEEP.place] || content('ambience').night || null;   // the night bed: the place's own, else the game's
      SLEEP.log.push({ place: SLEEP.place, dark: true });
    }
  } else if (SLEEP.ph === 'hold') {
    if (SLEEP.t >= SLEEP_T.hold) {
      SLEEP.ph = 'in'; SLEEP.t = 0; SLEEP.amb = null; sleepMusic(1);
      const fn = SLEEP.then; SLEEP.then = null; SLEEP.count++;
      if (fn) { const r = fn(); if (Array.isArray(r)) Script.queue.unshift(...r); }
      nextStep();   // the 'HP and Ki restored' line opens as the light comes back
    }
  } else if (SLEEP.ph === 'in') {
    SLEEP.a = Math.max(0, 1 - SLEEP.t / SLEEP_T.in);
    if (SLEEP.a <= 0) { SLEEP.ph = null; SLEEP.place = null; }
  }
}
function drawSleep() {
  if (SLEEP.a <= 0) return;
  X.fillStyle = `rgba(4,3,10,${SLEEP.a})`; X.fillRect(0, 0, W * S, H * S);
}

// Job fw-F3a: { sleep: place, then } in the story-step table (01a_game.js)
defineStep('sleep', { owner: 'core', order: 1040, when: s => !!s.sleep, run: s => sleepStart(s) });
