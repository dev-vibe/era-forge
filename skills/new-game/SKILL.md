---
name: new-game
description: Use when the person wants to start a new game on Eraforge: run the setup interview before any art or code, write the game's charter and game.json, and lay out its repo.
---

# Start a new game on Eraforge

1. **Interview first.** Run `playbooks/setup-interview.md` with the person, one area at a time. Offer the example answers (Ronin's) as
   examples, never as defaults. Nothing is drawn or coded before the charter is approved.
2. **Write the charter** (`charter.md`: the answers, each change logged later with its date and reason) and **`game.json`** (id, name,
   title, screen, kits, theme, save key, hero, start, and the charter answers the engine reads).
3. **Lay out the repo** as the README's "What a game supplies" table says: `src/` (content registered through `content(kind)` and
   `GAME_HOOKS`), `assets/game/`, `catalogue.json`, `tests.json`, a pinned `"eraforge": "github:dev-vibe/era-forge#<release commit sha>"` (the README's Releasing section)
   dependency. `sample-game/` is a working example of every file.
4. **Style anchor first:** the art pipeline is anchor-first; the first art job approves the game's anchor image and style block.
5. **First build and test:** `npx eraforge build`, then a playthrough test on the test clock (`playbooks/testing.md`) before the first
   merge. Until its art lands, `game.json` `standIn: true` gives marked stand-ins for every missing picture.
