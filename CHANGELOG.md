# Changelog

Each release says what a game must change to upgrade. Upgrading is a job of its own (the `fw-upgrade` skill is its procedure): bump the
pin in the game's `package.json` to the release's full commit sha, apply the notes below, run the game's full test group.

## Upgrade table

Releases are commits (no tags). Find your pin's row, then apply every section after it, in order. *Game must change* is **yes** when a
game has to touch a file of its own (a game that does none of the listed things changes nothing); the section says exactly what.

| Release | Commit | Game must change | In one line |
| --- | --- | --- | --- |
| 0.2.1 (30 Oct 2026) | `70eed01b5989223a1d3a2540ecdb2c97038d1f8d` | no | water behind fights, the hero's reflection on water, rings round his feet in moving water |
| 0.2.0 (30 Oct 2026) | `9e7f08bff43c57cbce6457639ff64f75fecceaa1` | yes, if it uses a moved tool or its own page builder | the not-moved tools move in (their settings become the game's files), `TEST_JUMPS` and the generated test page, `fw-upgrade` |
| 0.1.0 (29 Oct 2026) | `878da00e72d72e15576d472867ecada0252a7acf` | first release | the engine, tools and test kit moved out of Ronin |

## 0.2.1 (30 Oct 2026, commit `70eed01`)

A game's water polish job (Ronin job 9). Engine only.

### What a game must change

Nothing. A game with still water that has no loop may add `reflect` polygons to its scene JSON to get the hero's reflection there.

### What changed

- **Water behind fights** (`kits/battle-turn/07b_battle_draw.js` `drawBattleWater`): a fight started in a painted scene uses a still
  crop of that painting as its backdrop, so its water stopped dead. The scene's water loops are now drawn over the crop, darkened and
  blurred the same way as the backdrop. `drawWaterLoops(cx, cy, ix, ctx)` takes the context to draw into (default `L`).
- **The hero's reflection** (`kits/topdown/05c_scene.js` `drawReflection`): mirrored under his feet, only on water, swaying a little and
  fading downwards; not mid-hop and not while a game's `hero` layer draws him in a story pose. Water = the loops' own masks (where the
  clip moves) plus a scene JSON's new optional `reflect` polygons (painting px) for still water that has no loop. Tuning: `REFLECT`.
- **Rings round his feet in moving water** (`drawWaterRings`, backdrop layer `water-rings`, order 210): one every few px of walking, a
  slow ring while he stands; only on a loop's mask (a game's own wading rings are untouched).
- `waterMask()` / `waterAt(x, y, 'loop' | 'all')`: the per-scene water mask behind both, in scene units.

## 0.2.0 (30 Oct 2026, commit `9e7f08b`)

Ronin job fw-F7: the tools that were still Ronin's own move into the framework, with the game's names read from its files; test jumps
and a generated test page become part of the framework; the upgrade procedure is written down.

### What a game must change

Nothing, unless it does one of these:

1. **Uses a tool that moved** (below): delete the game's copy, and put the tool's data in the settings file the tool now reads (shapes in
   each tool's header). Ronin's `tools/cine_shots.py`, `tools/theme_shots.py`, `tools/review_page.py`, `tools/site/test-tools.css`,
   `tools/site/test-tools.js`, `tools/site/saves.html`, `gp/tools/*` and `bal/dump.py` went; `tools/cine_shots.json`,
   `tools/theme_shots.json` and `game.json` `site` came.
2. **Has its own page builder** (`eraforge.json` `build`): strip `buildlib.BUILD_ONLY_KEYS` from `game.json` before injecting it as
   `const GAME` (`for k in fw.BUILD_ONLY_KEYS: GAME.pop(k, None)`), not just `_about`: the list now has `site` as well as `_about`, `art`
   and `release`, and a page must not ship any of them.
3. **Imports `theme_shots`** (a test that reads the screens): `from theme_shots import SCREENS, PRE` is now
   `import theme_shots; PRE, SCREENS = theme_shots.game_screens()`; the screens are the game's `theme_shots.json` (`pre`, `screens`, and
   `preload` for the web-font pieces its text uses).
4. **Calls `cine_shots.main(scene, SHOTS=False)`**: unchanged, but the scenes are the game's `cine_shots.json` (`set`, `starts`, `plan`,
   `final`), no longer a table in the tool.
5. **Has a Foreground Painter or road ground audit** (`scene_tool.json` `fgpainter` / `painter` with those templates): the templates are
   the framework's now (by file name, the `gp/tools/...` paths in the settings still work) and name no game. The fg `text` edits start from
   the neutral words (`The whole painting.`, `Painting with foreground overlay`, `fg_audit.png`, `fg_mask.png`), and a road audit gives its
   picture's `alt` text; `__GAME__`, `__GAMEID__` and `__HERO__` come from `game.json`.
6. **Hosts another game and lists its animation sheets** in its own `animation_reviews.json`: a hosted game's categories now come from
   that game's own `animation_reviews.json` (merged after the host's, art read from `games/<id>/`); remove the copy from the host's file
   or the build refuses the duplicate slug.
7. **Defines a global called `TEST_JUMPS`, `defineTestJump`, `testJumpList` or `testJump`**, or reads a `?jump=` query itself: the engine
   owns them now (see the engine notes).
8. **Wants the site files to carry names other than the defaults**: set `game.json` `site` (`testReady`, `controlsKey`, `saveBackupKey`;
   defaults `<ID>_TEST_READY`, `<id>_test_controls_`, `saveKey` with `_vN` turned into `_backup_vN`). Ronin sets all three explicitly.

### Moved or renamed

- **Tools:** `cine_shots` (`npx eraforge run cine_shots <scene>`; scenes in the game's `cine_shots.json`), `theme_shots`
  (`run theme_shots shoot|compare`; `theme_shots.json`), `review_page` (the wrapper the review-page builders import), `bal_sim` (the battle
  kit's rules replayed in Python; the game keeps its player policy, which hands `act` and `make_party` over) and `bal_dump`
  (`run bal_dump`; writes the game's `bal/data.json`; it reads `levelTechs()`, which replaced the `LEVEL_TECHS` constant in the engine in Ronin job
  fw-F2, so a copy of the old dump script no longer runs).
- **Templates:** `kits/topdown/painters/gp_foreground_painter_template.html` and `road_ground_painter_template.html` (neutral, with slots).
- **Site files:** `tools/site/test-tools.css`, `test-tools.js`, `saves.html`, with the game's names in their slots (`__GAME__`,
  `__GAMEID__`, `__HERO__`, `__CURRENCY__`, `__SAVE_KEY__`, `__BACKUP_KEY__`, `__TEST_READY__`, `__CONTROLS_KEY__`); a game's own file of the
  same name in its `tools/site/` is used as it is.
- **Sample game:** Cincinnatus' animation sheets are its own `animation_reviews.json` (they were in Ronin's).

### New in the engine

- **`TEST_JUMPS`** (`core/01a_game.js`, section 9): `defineTestJump(id, { label, group, order, state, flags, inv, run })`,
  `testJumpList()`, `testJump(id)` (a clean journey, then `run()`), and `?jump=<id>` on the game page (started once the images have loaded;
  `window.TEST_JUMP` names it). This adds those four names, and a comment block, to every built page.
- **A generated test page:** a game whose `src/` calls `defineTestJump(` gets `tests.html` and `tests_fragment.html` from `npx eraforge
  build` (one button per jump, grouped, restart, its own practice save slot `<id>_review_jumps`); the site builder hosts it at
  `/games/<id>/test/` (the main game's at `/test/jumps/`) and adds a card to the test hub, beside the game's existing cards. A game with its
  own test hub keeps it.
- **Site:** `game.json` `site`; `build.json` lists the new pages; the hub is written after the games so it can link them.
- **Scene tool:** `alt` is a painter setting; `__GAME__` / `__GAMEID__` / `__HERO__` fill templates.
- **Test kit:** `zero_names_test` also checks the framework's templates, site files and its tools' strings for a game's names, and the
  generated test page; `cincinnatus_test` checks the sample game's eleven jumps and its test page; `framework_test` checks the upgrade
  table.
- **Skill:** `fw-upgrade`.

## 0.1.0 (29 Oct 2026, commit `878da00`)

The first release: the engine, tools and test kit that Ronin was built on, moved out of the Ronin repo (Ronin job fw-F5; one initial commit,
the history stays in the Ronin repo).

- **Engine:** `core/` (loop, input, audio, assets, save spaces and migration, the test clock, the mode, content, hook, story-step and
  draw-layer registries, dialog, story steps, the cinema layer, the UI kit, settings, the shell), `systems/` (items and shops, party,
  Chronicle, bonds and letters, pressure, travel), `kits/topdown/` (painted scenes, walk areas, occluders, doors and warps, water shimmer,
  songs, the scene editor and the Ground Painter templates), `kits/battle-turn/`, `kits/minigame/`. `themes/plain/`, the test theme, and
  the theme contract (`themes/README.md`).
- **Build:** `npx eraforge build`: the engine's files for the kits a game's `game.json` names, plus the game's `src/*.js`, in file-name
  order; a game may name its own page builder (`eraforge.json` `build`) that uses `buildlib`.
- **Site:** `npx eraforge site`: the hosted game, test and review pages, test hub and animation test sheets from the game's
  `catalogue.json`, with site hooks for the game's own page kinds; other games hosted at `/games/<id>/`.
- **Tools:** the scene command (`npx eraforge scene mask|painter|fg|link|trace|list`, a game's named steps in its `scene_hooks.py`), the
  sprite slicers (`make_char`, `make_pose`, `make_portrait`, `make_sit`, `make_anim`, `ingest`), `wire_art`, `snap_pos`, `scene_map`,
  audio (`make_music`, `make_sfx`, `find_loop`), the animation test sheets (`make_animation_category_review`).
- **Test kit:** `testlib` (the test clock, in-page loops, warm workers), the runner (a game's `tests.json`), and the framework's own checks:
  `framework_test`, `zero_names_test` (the sample game's page names no Ronin person, place or thing) and `cincinnatus_test` (the sample
  game played through).
- **Sample game:** `sample-game/`, Cincinnatus, 458 BC (the second-game slice of Ronin job fw-F6), now on the plain theme.
- **Not in this release** (still Ronin's own files then; moved in 0.2.0): the cutscene shooter `cine_shots.py`, the theme screenshot tool
  `theme_shots.py`, the review-page wrapper `review_page.py`, the site's `test-tools.css` / `test-tools.js` / `saves.html`, the Foreground
  Painter and road ground-audit templates, the balance simulator `bal/`.
