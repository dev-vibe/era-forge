# Testing a game on the test clock

The framework's engineering conventions for tests. They hold for any game; a game's own rules (what its story tests cover, which checks
gate a release) are in its own docs.

## The test clock

A test page sets `window.TEST_CLOCK` before it loads (`core/08_main.js`): the game's real-time loop stops and the test steps frames itself
(`testStep(n)` = n × update + end of input frame, no rendering). Nothing waits in real time. `Math.random` is seeded (mulberry32), so a run
repeats exactly; audio draws its own random numbers from `arand()` (`window.AUDIO_RANDOM` on a test page), never the seeded `Math.random`,
because real-time audio timers would shift the game's sequence.

A new test goes in the game's `tests/` folder (and in a group of its `tests.json`) and starts with:

```python
import testlib
PORT = testlib.serve('pub_<id>')                       # the game's built folder, served in this process on a free port
pg = testlib.page(browser)                             # a page on the test clock
pg.goto(f'http://localhost:{PORT}/test.html')          # returns when every image has loaded and the title is up
```

- `pg.wait_for_timeout(ms)` steps `ms × 0.06` frames. Never `time.sleep`, page timers or wall-clock bounds.
- **Loops go in the page.** Every `pg.evaluate`, `pg.step` or key event is a round trip of about 1.5 ms of CPU, so never write a Python
  loop that polls state and steps frames. Use `pg.until(js, n)` (check, step a frame, at most n frames), `pg.wait_for_function`,
  `testlib.tap`, `testlib.story_advance` (press through dialogs, cards and fights), or your own loop in one
  `pg.js("async (arg) => { ... await __T.step(n); await __T.tap('KeyZ', 4, 8); ... }", arg)` (the helpers: `IN_PAGE` in `testkit/testlib.py`),
  handing back to Python only to take a screenshot.
- A test page waits for the web fonts its text uses before `TEST_READY`.
- Real-clock tests (audio, a song player, a dance clock) use `testlib.page(..., clock=False)`; such a page draws at 30 fps
  (`testlib.HALF_RATE`) and the test waits for the state it checks, with a real-time limit, never a fixed sleep. List them under
  `realclock` in `tests.json`.

## The runner

`npx eraforge test [group|test ...]` (or the game's own `python3 run_tests.py ...`) reads the game's `tests.json`:

```json
{ "groups": { "quick": ["a_test.py"], "all": ["a_test.py", "b_test.py 1"] }, "default": "quick",
  "weights": { "a_test.py": 40 }, "realclock": ["smoke_test.py"] }
```

A test name is looked up in the game's `tests/`, then in the framework's `testkit/tests/` (the framework's own checks, which a game may
list too). Test-clock tests run in long-lived **workers** (`testkit/worker.py`, one per CPU: one Python, one Playwright driver, one
Chromium and one warm game tab, reset between tests, every folder served from one origin); real-clock tests run beside them, one at a
time. `--isolated` runs each test as its own process (about twice the CPU). So a test must not depend on being a fresh process: get the
browser from `p.chromium.launch()` and pages from `testlib.page`, and keep state in the page, not in module globals another test would see.
Review screenshots are skipped in runner runs (`ERAFORGE_SHOTS=0`); `--shots`, or running the test file by itself, takes them; a
screenshot a check reads back is taken with `check=True`. `--shard I/N` and `--list` split and list a run.

## Machines

`ERAFORGE_CHROMIUM_EXECUTABLE` names a Chrome when Playwright has no Chromium of its own (CI runners, Windows). A game's `eraforge.json`
may map its own older variable names onto the framework's (`testlib.envAliases`) and list the `file://` prefixes its older tests
hard-coded (`testlib.legacyFileRoots`).

## The gate

Tests green before a merge: the game's `all` group (and whatever its own docs add). For the framework itself, see the release gate in the
README.
