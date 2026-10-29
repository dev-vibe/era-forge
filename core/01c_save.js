// ============================================================
//  Save namespaces and the migration chain (job fw-F3c, 28 Oct 2026; core/save; plan: the framework plan)
//  A system keeps the state it saves in its own namespace, G.sys[<id>] (written to the save as `sys`), instead of loose keys in the
//  story-flag bag G.f. The core owns the save format and its version; systems register what they own:
//
//    defineSaveSpace(id, { init, loaded, resume, placed, battleScene })
//      init()          a fresh state for G.sys[id] (sysState(id) creates it on first use, New Journey clears every namespace)
//      loaded(d)       runs once the core fields are back (G.f, G.hero, G.inv, the party), before the hero is placed
//      resume(d)       may take over placing the hero (return true: the core does not enter the saved scene or map)
//      placed(d)       runs after the core has placed the hero
//      battleScene()   true: a save made inside a battle that returns to a scene keeps the scene position
//    defineSaveMigration(fromVersion, id, run)   run(d) upgrades a save of `fromVersion` to the next version, in place
//
//  loadData() (05_field.js) calls migrateSave() first, so a save of an older version would be upgraded step by step before anything
//  reads it; the steps for one version run in the order they were registered.
//  Version 3 (job fw-F3b, 28 Oct 2026): EVERY system keeps its state in d.sys (travel, party, bonds, chronicle, pressure); G.f holds only
//  the game's own story flags. Ash, 28 Oct 2026: "there are no saves currently, so go ahead and change it to only the new way": there
//  are no migration steps, and readSave() (01_core.js) offers only a save of the current version (an older one is ignored, so the title
//  shows New Journey only). A future format change registers its step here with defineSaveMigration.
// ============================================================
const SAVE_VERSION = 3;
const SAVE_SPACES = {};
function defineSaveSpace(id, def) { SAVE_SPACES[id] = Object.assign({ id }, def); return SAVE_SPACES[id]; }
function sysState(id) {
  const all = G.sys || (G.sys = {});
  if (!all[id]) { const def = SAVE_SPACES[id]; all[id] = def && def.init ? def.init() : {}; }
  return all[id];
}
function saveSpaces(hook) { return Object.values(SAVE_SPACES).filter(s => typeof s[hook] === 'function'); }
// Play time (job fw-F4): the journey's own clock, in seconds, in the core's save space `play` (job title-river-art kept it loose at the
// save's top level as `pt`; a save written that way still counts: its pt is taken in when it loads, and playTime() reads either).
defineSaveSpace('play', { init: () => ({ time: 0 }), loaded: d => { if (!d.sys.play && Number.isFinite(d.pt) && d.pt >= 0) sysState('play').time = d.pt; } });
// seconds played in save d (after migrateSave), or undefined when the save never counted them
function playTime(d) { const s = d && d.sys && d.sys.play; return s && Number.isFinite(s.time) ? s.time : d && Number.isFinite(d.pt) && d.pt >= 0 ? d.pt : undefined; }

const SAVE_MIGRATIONS = [];
function defineSaveMigration(from, id, run) { SAVE_MIGRATIONS.push({ from, id, run }); }
// A save is JSON, so the copy is exact; the caller's object is never changed.
function migrateSave(raw) {
  const d = JSON.parse(JSON.stringify(raw || {}));
  if (!d.sys || typeof d.sys !== 'object') d.sys = {};
  for (let v = d.v || 1; v < SAVE_VERSION; v++) for (const m of SAVE_MIGRATIONS) if (m.from === v) m.run(d);
  d.v = SAVE_VERSION;
  return d;
}
