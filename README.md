# Eraforge

A framework for painted, story-led history games that run in the browser: an engine core, genre-neutral systems, kits (top-down
exploration, turn battles, minigames), the build and site tools, a test kit that runs the game on a test clock, and the agent playbooks.
It holds no design opinions: each game answers the setup interview (`playbooks/setup-interview.md`) and keeps the answers in its own
charter. Built from the Ronin game (job fw-F5, 29 Oct 2026); `sample-game/` is a small second game the framework tests itself with.

## Layout

```text
core/          loop, input, audio, assets, save spaces, the test clock, the mode, content, hook, story-step and draw-layer registries,
               dialog, story steps, cinema grammar, UI kit, settings and accessibility; shell.html (the page)
systems/       items and shops, party, Chronicle, bonds and letters, pressure, travel
kits/
  topdown/     painted scenes, walk areas, occluders, doors and warps, water shimmer, songs; editor.html; painters/ (Ground Painter pages)
  battle-turn/ timing ring, intents, posture, battle draw and effect recipes
  minigame/    the shell, rhythm core, timing and posture helpers
themes/        plain/ (the test theme every game can build with) and README.md (the theme contract)
tools/         eraforge.py (the command), build.py + buildlib.py, build_site.py, gamepaths.py, the scene command, sprite slicers, audio tools,
               animation test sheets
testkit/       testlib.py, run_tests.py, worker.py; tests/ (the framework's own checks)
skills/        agent skills: next-job, new-game
playbooks/     engineering conventions: testing, the setup interview, the lessons log
sample-game/   Cincinnatus, 458 BC: the game the release gate builds and plays
bin/           the npm command (`eraforge`)
```

## How a game pulls it in

A game is its own repo with the framework as a pinned npm package from a git tag:

```json
"dependencies": { "eraforge": "github:dev-vibe/era-forge#v0.1.0" }
```

`npm ci` installs it in `node_modules/eraforge` (agents can read the pinned source there). Then, from the game's folder:

```text
npx eraforge build [--linked]          the game's pages (pub_<id>/, or the game's own page builder)
npx eraforge site                      the hosted site, site/
npx eraforge test [group|test ...]     the game's tests (its tests.json)
npx eraforge scene <step> <scene>      the top-down kit's scene steps: mask, painter [--fg], fg, link, trace, list
npx eraforge run <tool> [args]         any framework tool (make_char, make_pose, make_portrait, wire_art, ...)
```

The tools are Python 3.10+ (Pillow, NumPy, OpenCV, Playwright where needed); the command is a small Node launcher.

**Local co-development:** `FW_PATH=../era-forge npx eraforge build` (or the game's own entry points, e.g. Ronin's
`FW_PATH=../era-forge python3 build.py`) runs a framework checkout instead of the installed package, so one change can be tried on the
game before it is tagged. No git submodules.

### What a game supplies

| File | What it is |
| --- | --- |
| `game.json` | id, name, title, screen, kits, theme, save key, hero, currency, start... injected into the page as `const GAME` (keys `_about`, `art` and `release` are not shipped) |
| `src/*.js` | the game's content and hooks: registered content kinds, story, scenes, its own systems' halves; joined with the engine's files in file-name order |
| `assets/game/` | processed art and audio the build reads, `*.scene.json` (painted scenes' geometry), `meta.json`; `assets/raw/` (originals) stays out of git |
| `themes/<id>/` | the game's look, if not `plain` (contract: `themes/README.md`) |
| `catalogue.json` | the hosted test pages and the hub card (`build_site.py`'s docstring has the format) |
| `tests.json` | the test groups (`playbooks/testing.md`) |
| `eraforge.json` | optional settings that are not game data: `pub`, `build` (own page builder), `config` (folder of the tools' settings files), `tests`, `host` (other games to serve at `/games/<id>/`), `testlib` |
| tool settings | `scene_tool.json` (+ `scene_hooks.py` for named steps), `animation_reviews.json`, `art.json`, ... in the config folder |

## The release gate

GitHub Actions is off, so the gate is local and is run **before every tag**, from a clean checkout of the commit to be tagged:

```text
npm test                                   # = npx eraforge test all, in this checkout (the game is sample-game/):
                                           #   framework_test    the package ships every folder, the command runs, the engine's layout
                                           #   zero_names_test   the sample game's built page names no Ronin person, place or thing
                                           #   cincinnatus_test  the sample game built and played through on the test clock: title,
                                           #                     farm, hut, the envoys cutscene, the stake wall, the breakout battle,
                                           #                     the yoke, the end card, the Chronicle, a replay, a lost fight
```

All three must pass. A release that changes the engine is also tried on each game before it is tagged, with `FW_PATH` pointing at the
checkout (Ronin: `FW_PATH=../era-forge python3 run_tests.py all hosting_test.py test_hub_test.py`). A game never has to be green for a
framework release, but a break found there is fixed first.

**Releasing:** bump `version` in `package.json`, add its section to `CHANGELOG.md` (what a game must change), run the gate, commit, then
`git tag v<version> && git push origin main v<version>`. Games move to it by bumping their pin (a job of its own).

## Conventions every game keeps

Tests on the test clock and green before merge; one branch per job with a preview; nothing published from code that is not committed and
pushed; approvals recorded with their words and date; new raw art pushed to the game's assets repo before hand-off. Engine and pipeline
lessons go in `playbooks/lessons.md`; setting lessons stay with the game.
