# Framework lessons log (engine and pipeline)

Framework doc. The plan (`claude/ronin-framework-plan.md`, "Agentic loops") keeps two lessons logs: engine and pipeline lessons here, so every game built on the framework inherits them; setting and story lessons stay in each game's own docs (Ronin's cutscene lessons: `claude/ronin-cinematics.md`). Add an entry whenever a job teaches something that would bite the next game too. One short heading per job, newest first; each lesson is a rule plus the incident that taught it.

## The theme layer (job fw-F4, 29 Oct 2026)

What the job built: Ronin's look behind a theme (`themes/ink-washi/`: tokens in `theme.json`, drawers in `ui.js` and `battle_fx.js`, art in `art/`), a plain test theme (`themes/plain/`), the widget registry (`THEME_WIDGETS`, `src/01a_game.js` section 8), `tests/theme_test.py` and `tools/theme_shots.py`. Contract: `themes/README.md`.

1. **Prove a look refactor with pixels, not with eyes.** Script every screen (`tools/theme_shots.py SCREENS`), shoot it on `main` and on the branch, and compare pixel for pixel; add the effect moments a battle test already shoots (`shots/fx/`). The test clock, the seeded `Math.random` and fonts loaded before the shot make it repeatable (two shoots of `main` were identical). 50 screens and 48 effect moments came out identical; anything less than identical is a change to explain.
2. **Prove "nothing draws the look directly" by leaving the look out of a build.** The plain-theme page carries none of the game theme's code, so any engine or content path that still calls a brush or paper helper throws. Static checks (no helper names, no palette literals, no font names outside `themes/`) catch the rest; screenshots of every screen in the test theme caught what grep did not (a scroll's rods, the Chronicle's rails, the loading screen).
3. **`page.evaluate(string)` calls the result when the string's last expression is a function.** A setup script that ended with `window.PARTY = () => {...}` quietly ran `PARTY()` on every screen. End a statement-list setup string with `true;`.
4. **The core keeps layout and bookkeeping, the theme decides looks.** `win()` still rounds and records the panel (`UI_PANELS`); `txt()` still lays out the text but asks the theme for its colour, font and shadow on that panel. A widget that returned whole layouts would make every theme re-implement them.
5. **Recipes stay in the kit, drawers go to the theme.** Which effect a moment starts, where and in what colour is battle design; how a `ring` or `ribbon` looks is the theme's. Effects drawn on the impact frame with an unscaled clock are a separate kind (`raw`), so the registry has to say which is which.
6. **A material is theme art; a name is game art.** The generated washi wash behind the title is paper, so it moved to `themes/ink-washi/art/`; the brush wordmark and the figures stay the game's (`game.json` `titleArt`).

## Title and front menu (job title-river-art, 28–29 Oct 2026)

What the job built: a painted title with separate figure layers, a brush wordmark and a paper wash, graded by how far the save has got (no save: pre-dawn; mid-chapter: morning, with Kichi only if he is following; liberated: day), a 90-frame first light, and one washi menu panel (Continue with a save summary, New Journey, Settings, scheme-aware hints in its footer). Details: `claude/ronin-title-screen.md`.

1. **The title reads the save; it never loads it.** Read the raw save, pass it through the save migration (`migrateSave`), then decide what to show. Loading would start the journey's systems on the title screen.
2. **What the title shows must use the game's own rules, not a copy of them.** The first brief put Kichi beside Hayato once the village was liberated; in the game he stops following at liberation (`kichiFollowing()` ends at `gonzo`) and only follows if the player took him. Any "who is with the hero" or "how far are we" question on a front screen calls the same predicate gameplay uses, through a hook. Writing the condition out again in the title code drifts.
3. **Check the save format before adding a field.** The brief asked for play time as `t`; `t` already held the save timestamp. Grep `saveData()` and the save spaces first; new state goes in a save space (`defineSaveSpace`), not loose at the top level.
4. **Old saves must still show something.** The summary falls back field by field (play time → "saved <date>" → "saved journey"), and a test seeds a save without the new field.
5. **Figure layers on a key screen are made to match each other.** A pixel walk sprite scaled up beside a painted 1300 px figure clashes; a second figure is generated with the first figure's layer attached as the style, scale and camera reference.
6. **Paintings are neutral daylight; the engine grades them, with the same function the scenes use.** The title copied the dawn grade's numbers from `drawScene()`; the next job should share one grade function so the two never drift.
7. **A fade or "first light" over a menu is engine-driven animation.** It needs an entry on the animation review sheet linking a playable engine test (play/pause, slow speed, frame step, replay), the same as any other animation.
8. **Ink lettering and other dry-brush line art go on pure white, keyed by darkness** (alpha = 255 − luminance, levelled so paper is clear and solid ink opaque), not on magenta with a colour key. Magenta keying leaves pink fringes in the dry-brush gaps. Sprite and pose sheets stay on flat magenta.
9. **Contrast checks measure images too.** The brush wordmark is an image, so `contrast_check.py` samples its ink against the painting under every grade, including the darkest frame of the opening fade and the all-assets-missing fallback.
10. **Hints live in the menu's own panel.** A separate box for control hints was the one unstyled thing on screen. The panel draws the scheme-aware hint (`keyName()`, touch text) on its footer line.
11. **Front-screen tone follows the title music.** Ash approved a low-key, lightly swung track and withdrew the brooding direction, so the darkest tier stays gentle (dawn at 0.6, no extra desaturation). Ask about the music's mood before setting a front screen's light.
12. **After an art or audio hand-off, check by content, not by file date.** The approved title track was rewritten on disk but was byte-identical to the old one; only a hash comparison showed it had not landed. Compare hashes (or `git diff --stat`) for every asset the hand-off claims to have changed.
13. **Scratch copies never go in the mirrored outputs folder.** A stray copy of a review PNG was left in the read-only outputs mirror. Work copies go in the session's scratch folder, never in the mirrored outputs folder.

## Fights on the painted scene (Ronin job battle-place, 1 Nov 2026)

What the job built: `battleStage` (the fight's camera window and everyone's marks, chosen together by a score), the walk onto the marks
(`B.tr`), authored `battleSpots`, the scene's sky layers behind a fight, a rim on fliers. CHANGELOG 0.2.5 has the details.

1. **Match the battle camera to the scene's scale before anything else.** Most of "the placement looks odd" was size: battle sprites were
   drawn for a room at heroK 1.5 over outdoor paintings at heroK 1, so fighters stood half again as tall as the fences. Zooming the
   window by battle heroK / scene heroK fixed the look and made placement easier (the formation covers a third less of the world).
2. **Score candidates; never take the first legal one.** A first-fit spiral search accepts any spot whose feet are on ground, up to
   300 px away. Score open ground round the feet (capped: past ~10 px it stops mattering), distance from where the sides met (with a
   growing cost past 80 px, or the line leaves the yard for a field that is merely roomier), and squeeze.
3. **Flood the hero's area on the walk mask itself, not on the coarse grid.** At a 3 px grid the thin necks between a yard's props break
   and the hero's "area" becomes a pocket the size of his feet.
4. **Crowded places get authored marks.** A camp yard full of tents, stools and a fire pit has no room for a 3-v-1 line at the right
   scale; no score finds a good one. `battleSpots` with `party` / `foes` marks, checked with a screenshot, is the honest answer.
5. **Carry the map into the fight.** The same painting behind the fight is only seamless if the fighters start where they stood and the
   camera moves from the field view: lerp the window and every fighter's world position together and scale the sprites with the zoom.
   A full-screen flash or wipe over the first frames hides exactly the continuity it is meant to show.
6. **Check the layers a scene draws behind its painting.** A battle backdrop that copies only the painting leaves a parallax sky black.
7. **Don't anchor on the meeting point where the camera cannot move.** In a one-screen room the anchor only slides the whole line across a
   fixed picture (the great hall's party ended up against the right wall and its boss in the middle). Anchor on the formation's own
   place along any axis the window cannot travel.
8. **Every placement should say what it is.** Rules, an authored spot, hand marks or a fallback: report it (`battlePlacement()`), show
   it on the review page, and give hand placement an editor on the real fight (real backdrop, real scale, the ground map shown), so a
   bad spot is fixed by dragging, not by guessing coordinates.
