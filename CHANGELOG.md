# Changelog

Each release says what a game must change to upgrade. Upgrading is a job of its own: bump the pin in the game's `package.json`, apply the
notes below, run the game's full test group.

## 0.1.0 (29 Oct 2026)

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
- **Not in this release yet** (still in the Ronin repo, as Ronin's own files because they name Ronin's content or look): the cutscene
  shooter `cine_shots.py`, the theme screenshot tool `theme_shots.py`, the review-page wrapper `review_page.py`, the site's
  `test-tools.css` / `test-tools.js` / `saves.html`, the Foreground Painter and road ground-audit templates, the balance simulator `bal/`.
