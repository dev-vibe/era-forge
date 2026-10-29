// ============================================================
//  Cincinnatus — the slice's story (job fw-F6, 29 Oct 2026). Livy 3.26-29; sources log: games/cincinnatus/sources.md.
//  Farm (area_farm) -> talk with Cincinnatus at the plough -> the envoys at the plough (staged cutscene, cinema layer) -> the night march
//  (cards) -> the stake wall at Algidus (minigame, 40_stakewall.js) -> the Aequi breakout (battle) -> the yoke (cards + Chronicle) ->
//  sixteen days later, back at the plough. One room: the Quinctius hut (room_hut).
//  Flags (G.f): cin_met, cin_envoys, cin_wall (the first stake wall's quality), cin_won, cin_yoke, cin_home, cin_end.
//  The scenes' story tables are the content kind `story` ({ scene id: { npcs, onEnter, events, ... } }), registered at the end of this file.
// ============================================================
const CIN_AT = { plough: [1290, 840], hutDoor: [1920, 745], landing: [1170, 420], start: [1380, 1300, 1], home: [1380, 1250, 1] };   // painting px of area_farm (sample_farm_B)

// ---- New Journey: the opening cards, then the farm (01a_game.js hook) ----
GAME_HOOKS.newGame = () => {
  G.card = { pages: [
    'Rome, in the year of the consuls Lucius Minucius and Gaius Nautius.\n458 BC.',
    'The Aequi have come down from their hills again. The consul Minucius marched against them, and now he and his army are shut up in their own camp on Mount Algidus, ringed by the enemy.',
    'Five horsemen slipped through the Aequian lines and rode to Rome with the news. The city is afraid.',
    'Across the Tiber, on four iugera of meadow, a farmer and his neighbour\'s boy are ploughing.',
  ], i: 0, t: 0, onDone: () => { enterScene('area_farm', CIN_AT.start); } };
};
// a beaten party who gives up wakes at the farm with half the bronze (charter area 5; 08_main.js gameoverUpdate halves it)
GAME_HOOKS.gameOverWake = () => { enterScene('area_farm', [1920, 790, 0]); run([['Racilia', 'You came back on a cart, Titus. Rest. Then go and finish it.']]); };
GAME_HOOKS.aim = () => {
  const F = G.f;
  if (!F.cin_met) return 'Lucius Quinctius is at the plough. Go and work beside him.';
  if (!F.cin_envoys) return 'Talk with Cincinnatus again.';
  if (!F.cin_home) return 'Mount Algidus.';
  return 'The furrow is waiting.';
};

// ---- the farm ----
const CIN_FARM_STORY = {
  tod: 'day', music: null,
  npcs: [
    { id: 'cin', name: 'Cincinnatus', x: CIN_AT.plough[0], y: CIN_AT.plough[1], dir: 2, cast: 'cincinnatus_50', when: () => !G.f.cin_envoys || G.f.cin_home, talk: () => cinTalk() },
    { id: 'racilia', name: 'Racilia', x: CIN_AT.hutDoor[0], y: CIN_AT.hutDoor[1], dir: 0, cast: 'racilia_45', hidden: () => !G.f.cin_home, talk: () => [['Racilia', G.f.cin_end ? 'Sixteen days. He says the barley did not notice.' : 'He is back. Go and say so to his face, he likes that.']] },
    { id: 'envoy_a', name: 'Envoy', x: CIN_AT.landing[0], y: CIN_AT.landing[1], dir: 0, cast: 'envoy_a', hidden: true, solid: false },
    { id: 'envoy_b', name: 'Elder Envoy', x: CIN_AT.landing[0] + 40, y: CIN_AT.landing[1] - 10, dir: 0, cast: 'envoy_b', hidden: true, solid: false },
  ],
  onEnter: () => [{ wait: 30 }, ['Titus', '(The sun is already high. He will have done half the field without me.)']],
  events: [{ flag: 'cin_home_seen', when: () => !!G.f.cin_home, run: () => cinHome() }],
};
function cinTalk() {
  const F = G.f;
  if (F.cin_end) return [['Cincinnatus', 'Again? The stake wall, I mean. You can practise it on the hard ground by the fig tree, if you like. It feeds nobody, but it settles the hands.'],
    { ask: 'Practise the stake wall?', opts: ['Practise', 'Not now'], then: [[{ mini: 'stakewall', opt: { replay: true } }], [['Cincinnatus', 'Then take the other handle. The ox will not wait for the Senate.']]] }];
  if (F.cin_home) return cinHome();
  if (!F.cin_met) return [
    () => { F.cin_met = 1; },
    ['Cincinnatus', 'Titus. You are late, and the ox has noticed.'],
    ['Titus', 'Father needed me to mend the fence. He says thank you for the seed.'],
    ['Cincinnatus', 'Tell him it is not a gift: he will give it back at harvest, with a little over for the trouble. That is how neighbours stay neighbours.'],
    ['', 'He leans on the plough handle and looks across the river, at the smoke over the city.'],
    ['Cincinnatus', 'There is talk in the market. Something on Algidus. When the city is frightened, it remembers where it put its old men.'],
    ['Cincinnatus', 'Take the goad. We plough to the willows before we eat.'],
  ];
  return cinEnvoys();
}

// ---- the envoys at the plough (Livy 3.26.7-11): the staged cutscene ----
function cinEnvoys() {
  const F = G.f, h = SC.hero, side = h.x < CIN_AT.plough[0] * SC.k ? -1 : 1;   // Titus stays on the side he came from (cinematics §5)
  return [
    { cine: true },
    { heroWalk: [CIN_AT.plough[0] + side * 190, CIN_AT.plough[1] + 50], speed: 0.9 },   // clear of the painted plough (x 1136-1280)
    { heroFace: side < 0 ? 3 : 2 },
    { shot: [CIN_AT.plough[0], CIN_AT.plough[1] - 70], zoom: 1.6, time: 90 },
    ['', 'He has just put his shoulder to the plough again when he stops, and shades his eyes.'],
    { shot: [CIN_AT.landing[0] + 20, CIN_AT.landing[1] + 60], zoom: 1.4, time: 110, block: true },
    { show: 'envoy_a', fadeIn: 30 }, { show: 'envoy_b', fadeIn: 30 },
    ['', 'Two men in white togas are climbing up from the ferry landing, picking their way between the furrows.'],
    { shot: [CIN_AT.plough[0] - side * 70, CIN_AT.plough[1] - 60], zoom: 1.4, time: 120 },
    // the envoys come round to the far side of him from Titus, side by side (no one stacked: cinematics §5)
    { walk: 'envoy_b', to: [CIN_AT.plough[0] - side * 170, CIN_AT.plough[1] - 15], speed: 1.2 },
    { walk: 'envoy_a', to: [CIN_AT.plough[0] - side * 240, CIN_AT.plough[1] + 20], speed: 1.2 },
    { face: 'envoy_b', dir: side < 0 ? 2 : 3 }, { face: 'envoy_a', dir: side < 0 ? 2 : 3 }, { face: 'cin', dir: side < 0 ? 3 : 2 },
    { wait: 30 },
    ['Elder Envoy', 'Lucius Quinctius. The Senate sends us to you.'],
    ['Elder Envoy', 'Put on your toga, and hear what the Senate commands.'],
    { wait: 40 },
    ['Cincinnatus', 'Is all well?'],
    ['Elder Envoy', 'The toga first.'],
    { wait: 30 },
    ['Cincinnatus', 'Racilia! The toga. From the chest.'],
    { show: 'racilia', fadeIn: 20 },
    { walk: 'racilia', to: [CIN_AT.plough[0] - side * 85, CIN_AT.plough[1] + 55], speed: 2.2 },
    { face: 'racilia', dir: side < 0 ? 2 : 3 },
    ['Racilia', 'Here. You still smell of the furrow.'],
    { insert: 'toga', hold: false, time: 120 },
    ['', 'He wipes the dust and the sweat from his face and arms with the edge of his tunic, and puts on the toga.'],
    { glint: 'cin', n: 6 }, { sfx: 'pickup' }, { wait: 30 },
    { cutin: 'cincinnatus_50', time: 50 },
    ['Elder Envoy', 'Hail, Dictator.'],
    ['Envoy', 'The consul Minucius and his army are shut up in their camp on Algidus, with the Aequi all round them. Five horsemen got through to tell us. The Senate has named you dictator, to save them.'],
    { wait: 40 },
    ['Cincinnatus', '...'],
    ['Cincinnatus', 'Then the field will have to wait for me. It has waited before.'],
    { face: 'cin', dir: side < 0 ? 2 : 3 },
    ['Cincinnatus', 'Titus. Go to the willows and cut twelve stakes. Straight ones. Then cooked food enough for five days.'],
    ['Titus', 'Me?'],
    ['Cincinnatus', 'You are seventeen, and you can carry. The Campus Martius, before the sun goes down. Every man of age in Rome will be there with his twelve stakes, and so will you.'],
    { shot: null, time: 80, block: true },
    { cine: false },
    () => { F.cin_envoys = 1; give('stakes'); },
    { card: [
      'He was carried across the Tiber in a boat. His three sons and his kinsmen met him on the far bank, and the lictors walked before him.',
      'He named Lucius Tarquitius master of the horse, closed the courts and the shops, and before sunset every man of fighting age stood on the Campus Martius with five days\' cooked rations and his twelve stakes.',
      'They marched at once. At midnight they reached Mount Algidus.',
    ] },
    () => { joinParty('cincinnatus'); },
    { mini: 'stakewall', opt: {}, then: v => { if (!F.cin_wall) F.cin_wall = (v && v.quality) || 'gappy'; } },   // the first result feeds the battle (charter area 6)
    () => cinBreakout(),
  ];
}

// ---- the Aequi breakout: how many get through depends on the first stake wall (charter area 7) ----
const cinFoes = q => q === 'tight' ? ['aequi_spear', 'aequi_warrior'] : q === 'sound' ? ['aequi_spear', 'aequi_warrior', 'aequi_spear'] : ['aequi_warrior', 'aequi_spear', 'aequi_warrior'];
function cinBreakout() {
  const F = G.f, q = F.cin_wall || 'gappy';
  return [
    { card: [q === 'tight' ? 'Before dawn the Aequi try the ring where it is newest. The stakes hold; only a handful find the one place to climb.' :
      q === 'sound' ? 'Before dawn the Aequi try the ring where it is newest. Most of it holds. Where it does not, they come through.' :
      'Before dawn the Aequi try the ring where it is newest, and they find the gaps in Titus\'s stretch of it.'] },
    () => { if (q === 'tight') partyKiFull(); },
    { battle: cinFoes(q), paint: 'bg_battle_algidus', noFlee: true, win: [
      () => { F.cin_won = 1; },
      { card: [
        'Inside their camp, Minucius\'s men heard the shouting from the ridge and knew help had come. They broke out at dawn, and the Aequi were caught between the two Roman armies.',
        'The Aequi begged for terms. The dictator let them live, but their commander Gracchus Cloelius and their leading men were brought to him in chains.',
        'Two spears were driven into the ground, a third bound across them. The Aequi laid down their arms and walked under the yoke, one by one.',
      ] },
      () => { F.cin_yoke = 1; },
      { card: ['Sixteen days later.'] },
      () => { leaveParty('cincinnatus'); F.cin_home = 1; enterScene('area_farm', CIN_AT.home); },
    ] },
  ];
}

// ---- back at the plough (Livy 3.29.7: he laid down the dictatorship on the sixteenth day) ----
function cinHome() {
  const F = G.f;
  if (F.cin_end) return cinTalk();
  return [
    { wait: 40 },
    { cine: true },
    { shot: [CIN_AT.plough[0], CIN_AT.plough[1] - 70], zoom: 1.5, time: 100, block: true },
    ['', 'The toga is folded in the chest again. Lucius Quinctius has his shoulder to the plough.'],
    { shot: null, time: 60, block: true },
    { cine: false },
    ['Cincinnatus', 'Titus. They gave me the office for six months. It took sixteen days. Why keep it?'],
    ['Titus', 'They say in the city you could have been king.'],
    ['Cincinnatus', 'They say a great many things in the city. Take the goad. We plough to the willows before we eat.'],
    () => { F.cin_end = 1; },
    { card: ['END OF THE SLICE\n\nCincinnatus, 458 BC: a test of the Eraforge framework. Thank you for playing.'] },
  ];
}

// ---- the hut ----
const CIN_HUT_STORY = {
  tod: 'day', music: null,
  npcs: [{ id: 'racilia', name: 'Racilia', x: 1180, y: 560, dir: 0, cast: 'racilia_45', when: () => !G.f.cin_envoys,
    talk: () => [['Racilia', 'If you are looking for him, he is where he always is. Take him this cup, and tell him the porridge will not wait for the Senate either.']] }],
};
registerContent('story', { area_farm: CIN_FARM_STORY, room_hut: CIN_HUT_STORY });
