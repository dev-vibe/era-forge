// ============================================================
//  The pressure system (job fw-F3b, 28 Oct 2026; was the engine half of 05k_fugitive.js, Job 12b, "Fugitive, light")
//  While the game says the hero is hunted, patrols walk a scene and call him out; a disguise worn in the right scenes makes them look
//  straight through him; a checkpoint questions him once per visit until he has passed it. Fights are capped: after `wins.max` won
//  fights the word has gone round and nobody picks another (no grinding). No stealth: patrols are the topdown kit's field foes with
//  the foe hooks peaceful() (looks through him), callout(f) (talks first), passBy(f) (says something once as he passes calmly) and onWin().
//  State: Pressure (per visit to the visit scene, never saved); the save namespace sys.pressure = { wins: fights won }; the checkpoint's
//  pass is a story flag the game names (G.f[passFlag]), since its own lines read it.
//  Reads only the game's content (01a_game.js), kind pressure:
//    { hunted(F),                                   the patrols walk and the checkpoint asks while this holds
//      disguise: { item, scenes: [scene ids], when(F) },   worn while the item is carried, in those scenes, while when(F) holds
//      visitScene,                                  entering it starts a new visit (patrols come back, the checkpoint asks again)
//      wins: { max },                               no more patrols or hatless checkpoint fights after this many won
//      patrols: { spots: [[x, y, r] in painting px], kind, party: [enemy ids], callout(f) -> steps, passBy(f) -> steps or null },
//      checkpoint: { scene, rect: [x0, y0, x1, y1] painting px, passFlag, run() -> steps } }
// ============================================================
const Pressure = { visit: 0, chkAsked: false, chkClear: false };   // per visit (reset on entering the visit scene, storyEnter 05d)
const pressureDef = () => content('pressure');
const pressureHunted = () => { const P = pressureDef(); return !!(G.f && P.hunted && P.hunted(G.f)); };
const pressureDisguised = () => { const D = pressureDef().disguise;
  return !!(G.f && D && has(D.item) && D.when(G.f) && typeof SC === 'object' && SC && D.scenes.includes(SC.id)); };
defineSaveSpace('pressure', { init: () => ({ wins: 0 }) });
const pressureWins = () => sysState('pressure').wins;
const pressureCapped = () => { const W_ = pressureDef().wins; return !!W_ && pressureWins() >= W_.max; };
// a new visit to the visit scene (storyEnter, 05d)
function pressureEnter(id) { if (id !== pressureDef().visitScene) return; Pressure.visit++; Pressure.chkAsked = false; Pressure.chkClear = false; }
// steps that count a won fight
const pressureWon = () => [() => { sysState('pressure').wins++; }];
// the patrols for the visit scene's foes (the game's scene data asks for them)
function pressurePatrols() {
  const P = pressureDef(), T = P.patrols;
  if (!T || !pressureHunted() || pressureCapped()) return [];
  return T.spots.map(([x, y, r]) => ({ kind: T.kind, x, y, r, party: T.party.slice(), callout: T.callout, peaceful: pressureDisguised, passBy: T.passBy, onWin: pressureWon }));
}
// a battle in the painted scene (the same backdrop crop as a field foe's)
function pressureFight(ids, win, extra) {
  return { battle: ids, paintImg: SC.img, win: win || [], ...(extra || {}) };   // its window and marks: battleStage (07_battle.js, job battle-place)
}
const pressureCleared = () => { Pressure.chkClear = true; };   // the checkpoint's guards were beaten: no more questions this visit
// called from storyIdle (05d): the checkpoint is asked once per visit, until he has passed it
function pressureIdle() {
  const C = pressureDef().checkpoint;
  if (!C || SC.id !== C.scene || !pressureHunted() || Pressure.chkAsked || G.f[C.passFlag] || Pressure.chkClear) return false;
  if (!pressureDisguised() && pressureCapped()) return false;   // no grinding (see wins.max)
  const h = SC.hero; if (!scIn(C.rect, h.x, h.y)) return false;
  Pressure.chkAsked = true; h.moving = false; run(C.run()); return true;
}
