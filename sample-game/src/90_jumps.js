// ============================================================
//  Cincinnatus — test jumps (job fw-F6, 29 Oct 2026; on the framework's TEST_JUMPS registry since job fw-F7, 30 Oct 2026).
//  Each jump starts a clean journey (a new hero, the flags and bread below) and puts the game at one moment. They are the buttons of the
//  game's generated test page (/games/cincinnatus/test/ when a site hosts it, pub_cincinnatus/tests.html locally), for /…/?jump=<id> links
//  (the animation review page) and for Ash's playtest. The registry and the page are the framework's: core/01a_game.js section 9.
// ============================================================
const CIN_MET = { cin_met: 1, seen_area_farm: 1 };
const cinJumpDef = (id, def) => defineTestJump(id, Object.assign({ inv: { bread: 2 } }, def));
cinJumpDef('farm', { label: 'The farm, first visit', group: 'Scenes', order: 10, run: () => enterScene('area_farm', CIN_AT.start) });
cinJumpDef('hut', { label: 'Inside the hut (Racilia at home)', group: 'Scenes', order: 20, flags: CIN_MET, run: () => enterScene('room_hut') });
cinJumpDef('plough', { label: 'Cincinnatus at the plough (talk to him)', group: 'Scenes', order: 30, flags: CIN_MET,
  run: () => enterScene('area_farm', [CIN_AT.plough[0] - 40, CIN_AT.plough[1], 3]) });
cinJumpDef('envoys', { label: 'The envoys at the plough', group: 'Cutscenes', order: 40, flags: CIN_MET,
  run: () => { enterScene('area_farm', [CIN_AT.plough[0] - 190, CIN_AT.plough[1] + 50, 3]); run(cinEnvoys()); } });
cinJumpDef('home', { label: 'Sixteen days later, back at the plough', group: 'Cutscenes', order: 45,
  flags: Object.assign({ cin_envoys: 1, cin_wall: 'tight', cin_won: 1, cin_yoke: 1, cin_home: 1 }, CIN_MET), run: () => enterScene('area_farm', CIN_AT.home) });
cinJumpDef('stakewall', { label: 'The stake wall at Algidus, then the breakout', group: 'Minigame and battle', order: 50, flags: Object.assign({ cin_envoys: 1 }, CIN_MET),
  run: () => { enterScene('area_farm', CIN_AT.start); joinParty('cincinnatus');
    run([{ mini: 'stakewall', opt: {}, then: v => { if (!G.f.cin_wall) G.f.cin_wall = (v && v.quality) || 'gappy'; } }, () => cinBreakout()]); } });
for (const [q, order, label] of [['sound', 60, 'a sound wall (3 Aequi)'], ['tight', 61, 'a tight wall (2 Aequi)'], ['gappy', 62, 'a gappy wall (3 Aequi)']])
  cinJumpDef(q === 'sound' ? 'breakout' : 'breakout_' + q, { label: 'The breakout after ' + label, group: 'Minigame and battle', order, flags: Object.assign({ cin_envoys: 1, cin_wall: q }, CIN_MET),
    run: () => { enterScene('area_farm', CIN_AT.start); joinParty('cincinnatus'); run(cinBreakout()); } });
cinJumpDef('practice', { label: 'Stake wall practice (score only)', group: 'Minigame and battle', order: 70,
  flags: Object.assign({ cin_envoys: 1, cin_wall: 'sound', cin_won: 1, cin_yoke: 1, cin_home: 1, cin_home_seen: 1, cin_end: 1 }, CIN_MET),
  run: () => { enterScene('area_farm', CIN_AT.home); run([{ mini: 'stakewall', opt: { replay: true } }]); } });
cinJumpDef('chronicle', { label: 'All three Chronicle entries (open the menu)', group: 'Chronicle', order: 90,
  flags: Object.assign({ cin_envoys: 1, cin_wall: 'tight', cin_won: 1, cin_yoke: 1, cin_home: 1, cin_home_seen: 1, cin_end: 1 }, CIN_MET),
  run: () => enterScene('area_farm', CIN_AT.home) });
const cinJump = id => testJump(id);   // kept for the older links and the sample game's test
