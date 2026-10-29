// ============================================================
//  Cincinnatus — review jumps (job fw-F6, 29 Oct 2026): /games/cincinnatus/?jump=<id> starts straight at a moment, for the animation
//  review page (tools/animation_reviews.json, category 'cincinnatus') and for Ash's playtest. The game's boot hook (GAME_HOOKS.boot, 08_main.js boot2) starts the jump
//  once the art has loaded.
//    farm      the farm, first visit             envoys    the envoys at the plough (talk to him again, or it starts at once)
//    stakewall the stake wall at Algidus         breakout  the breakout fight after a sound wall      home   sixteen days later
// ============================================================
const CIN_JUMPS = {
  farm: () => { enterScene('area_farm', CIN_AT.start); },
  envoys: () => { G.f.cin_met = 1; G.f.seen_area_farm = 1; enterScene('area_farm', [CIN_AT.plough[0] - 190, CIN_AT.plough[1] + 50, 3]); run(cinEnvoys()); },
  stakewall: () => { Object.assign(G.f, { cin_met: 1, seen_area_farm: 1, cin_envoys: 1 }); enterScene('area_farm', CIN_AT.start); joinParty('cincinnatus');
    run([{ mini: 'stakewall', opt: {}, then: v => { if (!G.f.cin_wall) G.f.cin_wall = (v && v.quality) || 'gappy'; } }, () => cinBreakout()]); },
  breakout: () => { Object.assign(G.f, { cin_met: 1, seen_area_farm: 1, cin_envoys: 1, cin_wall: 'sound' }); enterScene('area_farm', CIN_AT.start); joinParty('cincinnatus'); run(cinBreakout()); },
  home: () => { Object.assign(G.f, { cin_met: 1, seen_area_farm: 1, cin_envoys: 1, cin_wall: 'tight', cin_won: 1, cin_yoke: 1, cin_home: 1 }); enterScene('area_farm', CIN_AT.home); },
};
function cinJump(id) {
  const go = CIN_JUMPS[id]; if (!go) return false;
  G.f = {}; G.sys = {}; G.hero = newHero(); G.inv = { bread: 2 }; G.allies = {}; G.active = []; G.card = null; Script.queue = []; Script.active = false; Dialog.active = false;
  G.state = 'scene'; go(); return true;
}
GAME_HOOKS.boot = () => {
  const id = new URLSearchParams(location.search).get('jump'); if (!id || !CIN_JUMPS[id]) return false;
  return cinJump(id);
};
