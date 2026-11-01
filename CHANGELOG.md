# Changelog

Each release says what a game must change to upgrade. Upgrading is a job of its own (the `fw-upgrade` skill is its procedure): bump the
pin in the game's `package.json` to the release's full commit sha, apply the notes below, run the game's full test group.

## Upgrade table

Releases are commits (no tags). Find your pin's row, then apply every section after it, in order. *Game must change* is **yes** when a
game has to touch a file of its own (a game that does none of the listed things changes nothing); the section says exactly what.

| Release | Commit | Game must change | In one line |
| --- | --- | --- | --- |
| 0.2.8 (1 Nov 2026) | `699455fef34b09644b84d07228135174fdae1a9d` | no | the battle spot editor shows the fighters on their marks right away (skips the standoff and the opening slide-in it would otherwise freeze) |
| 0.2.7 (1 Nov 2026) | `54ecf8fd7f6baab343847dd8053d561d617e11f7` | no | the battle spot editor's Save writes the spot into the game's own scene file (folder access, remembered; a download where a browser has none); "every fight in this scene" |
| 0.2.6 (1 Nov 2026) | `64e4f7f25efcc08278af0008ebdf29a22cce2b38` | no | how a fight was placed (`battlePlacement()`: placed / spot / rules / fallback / fixed), the battle spot editor (07e), `opts.spot`, a spot's `view`; one-screen rooms keep the centred formation |
| 0.2.5 (1 Nov 2026) | `2f8bf8edecee8dcf590b0f0528a0e3e039184cbc` | no (optional: `battleSpots`, `foeNpc`, `GAME.battle.heroK`) | a fight on its own scene zooms to the scene's scale, stands where the two sides met (scored placement), walks everyone onto their marks, draws the scene's sky layers |
| 0.2.4 (31 Oct 2026) | `f1bb9dedc41582b3c6baea2ae719f57e234113e0` | no | an animation category's engine-test link may point at a review page (`/review/<key>/`) |
| 0.2.3 (31 Oct 2026) | `9e60c67f24a8adf671d04acb0610531c626e1353` | no | the water sparkle takes a painted mask (and match, density, strength, sun, loop, speed), so any painting can sparkle only on its water, seamlessly |
| 0.2.2 (31 Oct 2026) | `f0b4e66fb90bf31e4ff609b10458fe276d750ca5` | no | a scene's `reflect` polygons fill even-odd, so a polygon inside another is a hole |
| 0.2.1 (30 Oct 2026) | `70eed01b5989223a1d3a2540ecdb2c97038d1f8d` | no | water behind fights, the hero's reflection on water, rings round his feet in moving water |
| 0.2.0 (30 Oct 2026) | `9e7f08bff43c57cbce6457639ff64f75fecceaa1` | yes, if it uses a moved tool or its own page builder | the not-moved tools move in (their settings become the game's files), `TEST_JUMPS` and the generated test page, `fw-upgrade` |
| 0.1.0 (29 Oct 2026) | `878da00e72d72e15576d472867ecada0252a7acf` | first release | the engine, tools and test kit moved out of Ronin |

## 0.2.8 (1 Nov 2026, commit `699455f`)

Ronin job battle-place: opening the battle spot editor on a fight that had not finished opening (a boss in its standoff, a fight just
restaged by Try it) froze the opening slide-in at its start, so the fighters were drawn off screen. `spotEditStart()` now skips the
standoff and ends the slide-in (and the wipe) before it holds the fight; Done goes on from the intro.

### What a game must change

Nothing.

## 0.2.7 (1 Nov 2026, commit `54ecf8f`)

Ronin job battle-place. Ash, 1 Nov 2026: "i should just be able to save it in the editor, no?", then "save, but in a place apps normally
save stuff. rememer, this needs to be solved for any user building games with this framework".

- The battle spot editor's **Save** writes the spot into the game's own project files, `assets/game/<scene>.scene.json` `battleSpots`,
  the way a desktop editor saves: the first Save asks for the game's folder through the browser's folder picker (File System Access),
  checks the folder's `game.json` names this game (`GAME.id`), and the browser remembers the folder (IndexedDB `eraforge`, key
  `project:<game id>`); later saves write straight there (the browser may ask once a session to allow editing). The file is read
  fresh from disk and only `battleSpots` changes (the spot replaced by id in place, or added; removed after Use the rules here), written
  in the layout the game's Python tools write (`json.dump`: `, ` and `: `, non-ASCII as `\u` escapes), so the diff is the spot.
- A browser without folder access (Firefox, Safari) downloads the updated scene file instead, to put in `assets/game/`.
- **every fight in this scene** (a checkbox) gives the spot an `r` covering the whole painting instead of `near`.
- Then the file is committed like any other change: nothing goes to a server.

### What a game must change

Nothing. (The folder chosen must be the game's own, with its `game.json`; scene files live in `assets/game/`.)

## 0.2.6 (1 Nov 2026, commit `64e4f7f`)

Ronin job battle-place, second part. Ash, 1 Nov 2026: "gonzo is worse now though, bc the chars are weirdly far to the right", then "the
engine should have a way to determine if the battle is a manually placed battle or one that uses the rules engine for placement, along
with an editor for those that are hand placed".

- **One-screen rooms keep the formation's own composition.** Along an axis where the fight's window cannot move (the painting is no
  bigger than the window), the rules anchor the line on the default formation's place instead of where the sides met: the meeting
  point would only slide the whole line across a fixed picture. Where the camera can travel, the meeting point anchors as in 0.2.5.
- **How a fight was placed:** `battlePlacement()` returns `{ mode, spot }`: `placed` (a `battleSpots` entry with its own `party` /
  `foes` marks: hand-placed), `spot` (the rules round an authored spot without marks), `rules` (the rules round where the sides met,
  or the room's composition), `fallback` (no room anywhere: the default formation) or `fixed` (a fight on its own painting). Also on
  `B.stage.mode`.
- **`opts.spot`** (a story battle step's `spot: '<battleSpots id>'`) names the spot a fight uses; `spot: false` keeps it to the rules.
  A spot may carry `view: [x, y]` (the window's top-left, scene px), which the editor writes.
- **The battle spot editor** (`kits/battle-turn/07e_battle_spot_editor.js`): `spotEditStart()` on a fight on a painted scene holds
  the fight and lets the author drag the fighters on the real backdrop at the real scale (arrow keys nudge, Shift 8 px), drag open
  ground to move the camera, and see the stage's ground map (green: feet can stand there) and a ring per fighter (green on good ground,
  red off it). Try it writes the spot into `SC.def.battleSpots` (in memory) and restages the fight from it; Use the rules here drops
  it; Copy JSON gives the scene file's entry `{ id, at, view, near | r, when?, party, foes }`; Done hands the fight back. A game's
  battle review page opens it (Ronin: the Battle Lab's Edit placement button); the game itself never does. The battle mode's update
  and UI hand over to it while it is on.

### What a game must change

Nothing. A game that wants the editor puts a button for `spotEditStart()` on its battle review page and pastes the JSON into its scene
file. Fights in one-screen rooms now stand where the default formation stands (when the ground allows), whatever side the hero met
the foe from.

## 0.2.5 (1 Nov 2026, commit `2f8bf8e`)

Ronin job battle-place (Ash, 31 Oct 2026: "often the placement of characters/enemies in the screen are odd"). A fight on the painted
scene it started on (`kits/battle-turn/07_battle.js` `battleStage`, `07b_battle_draw.js`):

- **The camera is zoomed to the scene's scale.** Battle sprites are drawn at `GAME.battle.heroK` (default 1.5) times a cast sheet's unit
  size; the scene draws its hero at the scene's `heroK` (1 outdoors). The fight's window is `battle.heroK / scene.heroK` times closer
  (1.5x outdoors, 1x in a room drawn at 1.5 or more; never wider than the field camera), so fighters stand at the size of the fences
  and lanterns around them.
- **The line stands where the two sides met**: the hero and the field foe (`opts.sceneFoe`), else the hero and an NPC whose id is an
  enemy's id (a boss he has been talking to) or `opts.foeNpc`, else the hero. The camera window and the formation are chosen together
  by a score: every fighter's feet on walkable ground in the hero's own area (flooded on the walk mask itself) and clear of the
  foreground layer, open ground round the feet (a chamfer distance on a 3 px grid), close to the meeting point (a move past 80 px costs
  more and more), squeezed only when it has to be. A tight spot pans the camera to the nearest open ground.
- **Authored spots** (optional scene JSON `battleSpots`, painting px): `[{ id, at: [x, y], r?: [x0, y0, x1, y1], near? (default 200),
  rad? (default 40), squeeze? (default .55), party?: [[x, y]...], foes?: [[x, y]...], when? }]`. A fight whose meeting point is in `r`
  (or within `near` of `at`) is searched close round `at`, squeezed down to `squeeze`; with `party` / `foes` everyone stands on those
  marks (a crowded yard, a boss's own place). Story steps may pass `at: [x, y]` (painting px) and `foeNpc: '<npc id>'`.
- **The walk onto the marks** (`B.tr`): a field fight (started from the `scene` state, not a boss with its standoff, not Try again,
  not `transition: false`) opens on a 3-frame impact frame instead of the encounter flash and the wipe, then the field view eases into
  the fight's window over 34 frames (24 on Fast) while everyone goes from where they stood on the map (`B.stage.from`: the hero and the
  foe he met where they were, companions from behind him, other foes from their side, fliers from above) to their mark, their sprites
  growing with the zoom. The panels come up when everyone is on their mark.
- **The scene's parallax layers are drawn behind the fight** (a sky behind a painting's transparent top was black). `parallaxRect(l,
  camX, camY)` (05c) is the layout both use.
- Bats and crows get a pale 1-art-px rim (`UI.paper`) so they read on dark ground.
- `foeEncounter` and `pressureFight` no longer pass the field camera's crop (the stage makes its own). `battlePlace` is gone;
  `battleGroundMap()` stays (battle screen px), now backed by `B.stage.grid`.

### What a game must change

Nothing. A game whose battle sprites are not drawn at heroK 1.5 sets `"battle": { "heroK": <n> }` in `game.json`. A fight on its own
painting (`paint` / `bg` that is not the scene's, a duel) keeps the fixed formation. `opts.view: false` keeps a scene fight on the old
field-camera crop; `opts.transition: false` skips the walk onto the marks.

## 0.2.4 (31 Oct 2026, commit `f1bb9de`)

Ronin job 12d-water-sparkle-cards: the road cards' sparkle plays on the road review page (`/review/road/`, one of the game's
`extraPages`), which has the pause, slow and step controls; the water animation sheet links it.

### What a game must change

Nothing. `make_animation_category_review` accepts `engineTests` links to `/review/...` as well as `/test/...` and `/games/...`.

## 0.2.3 (31 Oct 2026, commit `9e60c67`)

Ronin job 12d-water-sparkle-cards: the Lake Biwa water sparkle (`kits/topdown/05b_water_shimmer.js`) on paintings that are not an
all-water far plate (Ronin's road cards, with sky, bridges and shore around the water).

### What a game must change

Nothing. A config without the new keys draws exactly as before (the far-plate defaults are unchanged; Ronin's lakeshore test checks it).

### What changed

- `waterShimmerPlate(im, config)` / `drawWaterShimmer(im, config, x, y, w, h)` take new optional config keys:
  - `mask`: the asset name of a painted water area (green or white on black, any size). Glints sit only on its pixels and the plate is
    cut to it, so nothing spills past the water's edge. Nothing is drawn until the mask has loaded (`waterShimmerPlate` returns null).
  - `match`: `'lake'` (default, the old rule: pale and medium blue/cyan) or `'cool'` (any pixel bluer than it is red, dark water too).
  - `density` (default .045), `strength` (alpha multiplier, default 1), `sun` (x of the sunlit column as a fraction, `null` = none,
    default .71).
  - `loop` (seconds): the sparkle repeats exactly after this long (the two wave speeds snap to whole cycles in it), so a recording
    loops without a jump. Default: free-running, as before.
  - `speed` (multiplier on the two wave speeds, default 1): a calmer or livelier sparkle. With `loop`, use 11.75 / speed seconds.
- `drawWaterShimmer` skips a missing image. A game draws it wherever its painting is drawn (Ronin: its road route's `drawStop`).

## 0.2.2 (31 Oct 2026, commit `f0b4e66`)

Ronin job 9: the reflection area painted by hand has holes (rocks and rice tufts standing in the water).

### What a game must change

Nothing. A scene whose `reflect` polygons do not overlap draws exactly as before; a polygon inside another now cuts a hole (`waterMask`
fills them as one even-odd path).

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
