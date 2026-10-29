---
name: next-job
description: Use when the person says "<Game>: next job" or names a production job for a game built on Eraforge, to restore the workspace, do the next queued job and hand off cleanly.
---

# <Game>: run the next production job

A pointer, not a rulebook: the game's repo holds its rules. Replace `<game repo>` with the game's repo (Ronin: `dev-vibe/Ronin`).

1. **Restore the workspace.** Attach and clone the game's repo (push access), register it, run `npm ci` (installs the pinned framework in
   `node_modules/eraforge`). Locally, use the person's existing clone and never run git in it through a remote shell.
2. **Read** the game's `CLAUDE.md`, then the files it names: its runbook (rules), status file (job queue, open items), charter (the game's
   design rules: they win over older docs) and story bible. The framework's conventions are in `node_modules/eraforge/README.md` and
   `node_modules/eraforge/playbooks/` (testing, lessons).
3. **Do the job** the person named, or the first open job in the status file. If it waits on the person, give them the exact prompt or
   question and stop. Confirm the job and its first action in one line.
4. **Work** on `job/<id>-<short-name>`: `npx eraforge test quick` after every change, the game's full gate before hand-off
   (`git fetch origin main && git merge origin/main`, rebuild, re-run, push). A change to the framework itself is made in a framework
   checkout and tried on the game with `FW_PATH=<checkout>`; it ships as a framework release (README: the release gate), then the game
   bumps its pin.
5. **Hand off:** update the game's docs in the repo with the job (one short status row; long notes in its archive), open the PR, and tell
   the person in two or three sentences what was done and what they need to do next.
