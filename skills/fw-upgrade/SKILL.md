---
name: fw-upgrade
description: Use when a game built on Eraforge moves to a newer framework release (bumps its pinned commit): read the CHANGELOG notes for every release in between, apply what the game must change, prove its pages did not change by accident, and run its full gate.
---

# Upgrade a game to a new Eraforge release

An upgrade is a job of its own (branch `job/fw-upgrade-<version>`), never a side effect of another job. The framework's
`CHANGELOG.md` is the source: its upgrade table lists every release in order, and each release's section says what a game must change.

1. **Find the gap.** The game's pin is in `package.json` (`github:dev-vibe/era-forge#<sha>`). In the framework's `CHANGELOG.md` upgrade
   table, find that sha's row; every row after it is a release to apply, in order. Read each release's section: **What a game must
   change** is the list; **Moved or renamed** and **New in the engine** say what else can touch the game.
2. **Take a baseline first, on the old pin.** Build the game (`npx eraforge build`, and `npx eraforge site` if it hosts a site) and keep a
   checksum of every built page and site file (`sha256sum` over `pub_*/`, the root pages and `site/`), so the upgrade can be checked
   byte for byte. Run the full test group once and note anything already red: a red test that was red before is reported, not hidden.
3. **Try it from a checkout before pinning.** In a checkout of the framework at the release commit: `FW_PATH=../era-forge npx eraforge build`
   and the game's own entry points (`FW_PATH=../era-forge python3 build.py`, `run_tests.py`). Apply the CHANGELOG's changes to the game's
   files only (its `game.json`, `eraforge.json`, `src/`, tool settings, tests). **Never edit `node_modules/eraforge`**; a problem in the
   framework is fixed in the framework and released again.
4. **Compare.** Rebuild and checksum again. Every page that differs must be explained by a line in the CHANGELOG (the engine's files are
   in every page, so an engine release changes every page; a game's own content must not change). List each difference, in the PR, as
   *file, what changed, which CHANGELOG line says so*. An unexplained difference is a bug in the upgrade: find it before going on.
5. **Pin it.** Set `package.json` to the release's **full sha** (`github:dev-vibe/era-forge#<40 hex digits>`; releases are commits, there
   are no tags), run `npm install`, commit `package.json` and `package-lock.json` together, then run `npm ci` from a clean tree and
   repeat the build and the checksums against the installed package instead of the checkout.
6. **Run the game's full gate** (its `all` group and whatever its docs add: hosting, hub checks). Never loosen, skip or delete a test to
   make it pass. A test that must change for a renamed path or API is changed in the smallest way that keeps what it proves, and the PR
   says so in a line of its own.
7. **Record it:** the game's status row (the release, the commit, the differences found), and tell the person what changed and whether any
   of it needs their go (hosting, merges).

Writing the release side (a framework change): add the release's row to the upgrade table in `CHANGELOG.md`, with "yes" in the *game must
change* column whenever a game has to touch a file, and say exactly what in the release's section. If you cannot say what a game must
change, run an old game against the new commit and see.
