// ============================================================
//  Settings: difficulty, timing aid, battle speed (Job 11, battle v2, 20 Oct 2026; the battle v2 design doc in claude/)
//  G.cfg = { diff, aid, speed, ctl } is saved with the game (saveData/loadData in 05_field.js), chosen at New Journey (08_main.js)
//  and changed any time on the menu's Settings page (06_menu.js). ctl (job a11y): the control scheme, 01b_input.js; a save without it loads as 'auto'.
// ============================================================
const DIFF = {
  story: { name: 'Story', atk: 0.7, hp: 0.85, post: 0.8, heal: 1, aid: 'wide', desc: 'For the tale. Gentler foes, wide timing, and everyone is back to full health after each won fight.' },
  standard: { name: 'Standard', atk: 1, hp: 1, post: 1, heal: 0.25, aid: 'standard', desc: 'The intended journey. After a won fight each fighter catches their breath and recovers a quarter of their HP.' },
  hard: { name: 'Hard', atk: 1.2, hp: 1.15, post: 1.25, heal: 0, aid: 'standard', desc: 'For swordsmen. Harder foes, tight timing with no ink ring, and no rest between fights.' },
};
const DIFF_IDS = ['story', 'standard', 'hard'];
const AID = { standard: 'Standard', wide: 'Wide', auto: 'Auto' };
const AID_IDS = ['standard', 'wide', 'auto'];
const AID_DESC = { standard: 'Press as the ink ring closes on the foe.', wide: 'A more forgiving window for every timed press.', auto: 'Every timed press lands as a Good by itself (a Perfect still needs your own press).' };
const SPEEDS = [1, 1.5];
// timing windows in battle ticks (60 a second): Perfect [early, late], Good [early, late]
const WINDOWS = { standard: { p: [2, 1], g: [6, 3] }, wide: { p: [4, 2], g: [10, 5] }, hard: { p: [1, 1], g: [4, 2] } };
function cfg() { if (!G.cfg) G.cfg = { diff: 'standard', aid: 'standard', speed: 1, ctl: 'auto' }; if (!G.cfg.ctl) G.cfg.ctl = 'auto'; return G.cfg; }
const diff = () => DIFF[cfg().diff] || DIFF.standard;
function timingWin() { const c = cfg(); return c.aid === 'wide' ? WINDOWS.wide : c.diff === 'hard' ? WINDOWS.hard : WINDOWS.standard; }
const timingRing = () => !(cfg().diff === 'hard' && cfg().aid !== 'wide');   // Hard shows only the glint
const timingAuto = () => cfg().aid === 'auto';
function setDiff(id) { const c = cfg(); c.diff = id; }

// ---------------- the Settings page of the menu ----------------
const SETTINGS_ROWS = [
  { name: 'Difficulty', get: () => DIFF[cfg().diff].name, step: d => { const i = DIFF_IDS.indexOf(cfg().diff); cfg().diff = DIFF_IDS[(i + d + 3) % 3]; }, desc: () => DIFF[cfg().diff].desc },
  { name: 'Timing aid', get: () => AID[cfg().aid], step: d => { const i = AID_IDS.indexOf(cfg().aid); cfg().aid = AID_IDS[(i + d + 3) % 3]; }, desc: () => AID_DESC[cfg().aid] },
  { name: 'Controls', get: () => CONTROL_NAMES[ctlSetting()] + (ctlSetting() === 'auto' && !Input.touchMode ? ` (${CONTROL_NAMES[Ctl.last]})` : ''), step: d => ctlStep(d), desc: ctlDesc },   // job a11y, tier 1
  { name: 'Battle speed', get: () => cfg().speed > 1 ? 'Fast' : 'Normal', step: () => { cfg().speed = cfg().speed > 1 ? 1 : 1.5; }, desc: () => cfg().speed > 1 ? 'Battle animations play faster (timed presses keep their pace).' : 'Battle animations at their natural pace.' },
];
function settingsUpdate() {
  const n = SETTINGS_ROWS.length;
  if (nav('up')) { Menu.sub = (Menu.sub + n - 1) % n; sfx('cursor'); }
  if (nav('down')) { Menu.sub = (Menu.sub + 1) % n; sfx('cursor'); }
  Menu.sub = clamp(Menu.sub, 0, n - 1);
  const r = SETTINGS_ROWS[Menu.sub];
  if (nav('left')) { r.step(-1); sfx('cursor'); }
  if (nav('right') || btn('a')) { r.step(1); sfx('ok'); }
}
function drawSettings(px, py, pw, highContrast = false) {
  txt('Settings', px + 18, py + 12, '#f6d890', 13);
  SETTINGS_ROWS.forEach((r, i) => {
    const y = py + 38 + i * 26, on = i === Menu.sub;
    if (on) selBar(px + 14, y - 3, pw - 28, 19);
    txt(r.name, px + 40, y, on ? '#fff' : highContrast ? UI.soft : '#a89c84', 13);
    txt(`◀  ${r.get()}  ▶`, px + pw - 22, y, on ? '#f6d890' : highContrast ? UI.soft : '#8a7e66', 12, 'right');
    if (on) cursor(px + 20, y + 1);
  });
  txt('Change these at any time. Left and right choose.', px + 18, py + 42 + SETTINGS_ROWS.length * 26, highContrast ? UI.soft : '#8a7e66', 10);
}
const settingsFoot = () => SETTINGS_ROWS[clamp(Menu.sub, 0, SETTINGS_ROWS.length - 1)].desc();
// job fw-F3b: the Settings page as a stock menu page (01a_game.js MENU_STOCK; the game registers it)
MENU_STOCK.settings = { label: 'Settings', input: () => settingsUpdate(), draw: (px, py, pw) => drawSettings(px, py, pw), foot: () => [settingsFoot(), '#f4ecd8'] };

// ---------------- choosing a difficulty at New Journey (08_main.js) ----------------
function drawDiffPick(sel, t) {
  X.fillStyle = 'rgba(8,4,2,.55)'; X.fillRect(0, 0, W * S, H * S);
  const x = 150, y = 70, w = 340, h = 210;
  win(x, y, w, h);
  headTxt('Choose your path', x + w / 2, y + 14, '#f6d890', 16, 'center', 700);
  DIFF_IDS.forEach((id, i) => {
    const yy = y + 52 + i * 28, on = i === sel;
    if (on) selBar(x + 18, yy - 4, w - 36, 22);
    txt(DIFF[id].name, x + 54, yy, on ? '#fff' : '#a89c84', 14); if (on) cursor(x + 30, yy + 1);
  });
  wrap(DIFF[DIFF_IDS[sel]].desc, w - 40, 11).slice(0, 3).forEach((l, i) => txt(l, x + 20, y + 144 + i * 16, '#f4ecd8', 11));
  txt('You can change this later under Settings in the menu.', x + w / 2, y + h - 18, '#8a7e66', 9, 'center');
}
