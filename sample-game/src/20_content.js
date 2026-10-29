// ============================================================
//  Cincinnatus — the game's data tables, registered in the content registry (01a_game.js) (job fw-F6, 29 Oct 2026)
//  Sources: Livy 3.26-29. History rules: charter area 3 (Livy is the record; real people speak; invented words and people are marked
//  in the Chronicle). No coins in 458 BC: the money is aes, rough bronze by weight.
// ============================================================
const ITEMS = {
  bread: { name: 'Barley Bread', desc: 'A flat loaf, baked on the hearth stones. Restores 25 HP.', price: 4, hp: 25 },
  posca: { name: 'Posca', desc: 'Sour wine cut with water, the soldier\'s drink. Restores 8 Ki.', price: 6, ki: 8 },
  stakes: { name: 'Twelve Stakes', desc: 'Cut from the willows by the river, as the dictator ordered: every man brings twelve.', key: true, taken: 'Driven into the ring at Algidus' },
};
const WEAPONS = {
  spear: { name: 'Hunting Spear', atk: 5, desc: 'An ash shaft with an iron head. Your father\'s.' },
  hasta: { name: 'Hasta', atk: 8, desc: 'A soldier\'s thrusting spear, issued at the muster on the Campus Martius.' },
};
const ARMORS = {
  tunic: { name: 'Wool Tunic', def: 0, desc: 'Undyed wool, patched at the elbows.' },
  shield: { name: 'Round Shield', def: 4, desc: 'Wood and hide, rimmed in bronze. Issued at the muster.' },
};
const TECHS = {
  thrust: { name: 'Spear Thrust', ki: 3, target: 'one', mult: 1.6, post: 4, desc: 'A straight thrust over the shield rim. 1.6× damage.' },
  brace: { name: 'Brace the Line', ki: 2, target: 'self', guard: 3, desc: 'Shield up, feet set. Halves damage for 3 turns.' },
  rally: { name: 'Rally', ki: 4, target: 'allies', healPct: 0.3, desc: 'A voice the line knows. Everyone fighting recovers 30% HP.' },
  order: { name: 'Hold the Ring', ki: 5, target: 'all', mult: 1.0, post: 3, sig: 1, desc: 'The command to close up. Hits every enemy and cracks their stance.' },
};
const ENEMIES = {
  aequi_warrior: { name: 'Aequian Warrior', cast: 'aequi_40', castScale: 1, hp: 30, atk: 8, def: 2, spd: 5, xp: 8, mon: 6, post: 6,
    skills: [{ chance: 0.3, mult: 1.6, heavy: 1, fx: 'heavy', msg: 'throws his weight behind the shield!' }] },
  aequi_spear: { name: 'Aequian Spearman', cast: 'aequi_30', castScale: 1, hp: 26, atk: 9, def: 1, spd: 6, xp: 8, mon: 6, post: 5,
    skills: [{ chance: 0.35, mult: 1.6, heavy: 1, fx: 'lunge', msg: 'drives his spear at the gap in the stakes!' }] },
};
const PARTIES = {};
const TRACKS = {};   // music comes with Suno (charter area 11); until then the slice is silent apart from the engine's effects

// the people: one entry per walking sheet and portrait (char_<id>.png, portrait_<id>.png). `look` is what the engine's marked stand-in
// figure (01e_standin.js, game.json standIn) wears until the app-made art for that person is in assets/game/.
const CAST = [
  { id: 'titus_17', name: 'Titus', note: 'farm youth (invented)', look: { tunic: '#b49a6a', belt: '#5a3a1e', skin: '#c8946a', hair: '#3a2416', legs: '#c8946a', young: 1 } },
  { id: 'cincinnatus_50', name: 'Cincinnatus', note: 'L. Quinctius Cincinnatus', look: { tunic: '#9a8a70', belt: '#4a3420', skin: '#b88660', hair: '#8a8478', legs: '#b88660', beard: '#8a8478' } },
  { id: 'racilia_45', name: 'Racilia', note: 'his wife', look: { tunic: '#8a5a4a', belt: '#5a3a2a', skin: '#c49270', hair: '#4a3020', legs: '#6a4a3a', long: 1 } },
  { id: 'envoy_a', name: 'Envoy', note: 'envoy of the Senate', look: { tunic: '#e8e2d2', belt: '#b8b0a0', skin: '#c08a64', hair: '#2e2018', legs: '#c08a64', toga: 1 } },
  { id: 'envoy_b', name: 'Elder Envoy', note: 'envoy of the Senate', look: { tunic: '#e4dcca', belt: '#8a2a3a', skin: '#b4805c', hair: '#5a5048', legs: '#b4805c', toga: 1, beard: '#5a5048' } },
  { id: 'aequi_30', name: 'Aequian Spearman', note: 'foe sheet', look: { tunic: '#6a5a3a', belt: '#3a2a1a', skin: '#b07a52', hair: '#2a1a10', legs: '#5a4a32', disc: '#b88a3a', shield: '#7a4a2a' } },
  { id: 'aequi_40', name: 'Aequian Warrior', note: 'foe sheet', look: { tunic: '#5a4a3a', belt: '#2e2216', skin: '#a8744e', hair: '#5a4a3a', legs: '#4e4030', disc: '#c09a4a', shield: '#5a3a24', beard: '#4a3a2a' } },
];

// the hero's numbers by level (the content kind `progression`: 05_party.js)
const PROGRESSION = {
  stats(h) {
    const lv = h.lv, w = contentGet('weapons', h.weapon), a = contentGet('armors', h.armor);
    return { maxHp: 40 + (lv - 1) * 9, maxKi: 10 + (lv - 1) * 3 + (h.bonus.ki || 0), atk: 6 + (lv - 1) * 2 + (h.bonus.atk || 0) + (w ? w.atk : 0),
      def: 3 + (lv - 1) + (a ? a.def : 0), spd: 6 + (lv - 1) };
  },
  xpTo: lv => Math.round(10 * Math.pow(lv - 1, 1.7)),
  techs: {},
};

const CIN_ALLIES = {
  cincinnatus: { name: 'Cincinnatus', cast: 'cincinnatus_50', weapon: 'Dictator\'s sword', role: 'dictator',
    stat: lv => ({ maxHp: 52 + (lv - 1) * 10, maxKi: 14 + (lv - 1) * 3, atk: 10 + (lv - 1) * 2, def: 5 + (lv - 1), spd: 5 + (lv - 1) }),
    techs: ['rally', 'order'] },
};
const CIN_PARTY_TALK = {
  cincinnatus: () => [['Cincinnatus', 'Keep your shield up and your eyes on the man in front of you, Titus. The rest is shouting.']],
};

// ---- the Chronicle (three entries; 05_chronicle.js reads the shape) ----
const INVENTED = '\n\n(Words in this game are invented where Livy is silent; the deeds are his.)';
const CIN_CHRONICLE = {
  tabs: ['History', 'People'],
  open: F => !!F.cin_met,
  notes: { question: 'An open question', History: 'From Livy', People: 'A person', default: 'From Livy' },
  footer: 'What {hero} remembers',
  glyph: 'L',
  entries: [
    { id: 'farm', tab: 'History', title: 'Four Iugera Across the Tiber', when: F => !!F.cin_met,
      text: F => 'Livy says Lucius Quinctius worked four iugera, about two and a half acres, on the far side of the Tiber, opposite the place where the city\'s dockyards later stood; men still called it the Quinctian Meadows in Livy\'s day. He had once been rich. When his son Caeso fled into exile before his trial, the father paid the bail the boy had forfeited, and it ruined him.' +
        (F.cin_home ? ' He went back to these fields when it was over.' : '') },
    { id: 'dictator', tab: 'People', title: 'Lucius Quinctius Cincinnatus', when: F => !!F.cin_envoys,
      text: F => 'The envoys of the Senate found him at work: digging a ditch, leaning on his spade, or ploughing; Livy gives both. He asked whether all was well, and called to his wife Racilia to bring his toga from the hut. Wiping off the dust and sweat, he put it on and was hailed as dictator. He named Lucius Tarquitius master of the horse, shut the shops, and ordered every man of fighting age to the Campus Martius by sunset with five days\' cooked rations and twelve stakes.' +
        (F.cin_home ? ' He laid the office down on the sixteenth day, having been given it for six months.' : '') +
        '\n\nHistorians doubt the details: the tale was told for centuries as a lesson in old Roman plainness before anyone wrote it down.' + INVENTED },
    { id: 'yoke', tab: 'History', title: 'Under the Yoke at Algidus', when: F => !!F.cin_yoke,
      text: F => 'The army marched at night and reached Mount Algidus at midnight. Each man dug a ditch and drove his stakes where he stood, and the whole army shouted as it worked, so that the consul Minucius\' trapped legions knew help had come and broke out against the Aequi from their side. Caught between the two, the Aequi begged for terms. Cincinnatus let them go with their lives, but first their commander Gracchus Cloelius and the leading men were brought in chains, and the rest passed under the yoke: two spears driven into the ground and a third bound across them, which the beaten walked beneath, unarmed.' },
  ],
};

for (const [kind, table] of Object.entries({ items: ITEMS, weapons: WEAPONS, armors: ARMORS, techniques: TECHS, enemies: ENEMIES, parties: PARTIES,
  music: TRACKS, allies: CIN_ALLIES, partyTalk: CIN_PARTY_TALK, chronicle: CIN_CHRONICLE, cast: CAST, progression: PROGRESSION,
  locations: [{ id: 'farm', name: 'The Quinctian Meadows', year: '458 BC', x: 0.5, y: 0.5, scene: 'area_farm' }],
  routes: {}, atlas: {}, itemStory: {}, keepsakes: {}, shops: {}, talks: {}, bondWords: {}, restStops: {}, letters: {}, letterNames: {}, epilogues: {},
  proofs: {}, debate: {}, pressure: {} })) registerContent(kind, table);

// the pause menu: the stock pages this game uses (01a_game.js MENU_PAGES)
[['items', 100], ['techniques', 110], ['equip', 120], ['status', 130], ['party', 140], ['chronicle', 160], ['settings', 170], ['save', 180], ['close', 190]]
  .forEach(([id, order]) => defineMenuPage(id, { stock: id, order }));
