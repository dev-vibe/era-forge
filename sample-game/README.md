# The sample game: Cincinnatus, 458 BC

A small, complete game on the framework, and the one the release gate builds and plays (`npm test` in the framework checkout). It began as
the second-game slice inside the Ronin repo (Ronin job fw-F6, 29 Oct 2026, approved by Ash) and moved here when the framework became its
own package (job fw-F5): the farm across the Tiber, the envoys at the plough, the stake wall at Algidus and the breakout, the yoke, and
the return sixteen days later (Livy 3.26–29).

- `game.json`, `charter.md` (the setup interview's answers), `sources.md`: what the game is.
- `src/`: its content and story, registered through the engine's content kinds and hooks.
- `assets/game/`: its processed art (painterly gouache, made in the ChatGPT app); originals are in Ronin's assets repo under
  `outputs/cincinnatus/` (`art.json`, `art-prompts.md`, `art-handoff-phase*.md` say what each is).
- `catalogue.json`, `tests.json`, `scene_tool.json`, `cine_shots.json`: its settings for the site builder, the runner and the tools.
- `framework-gaps.md`: what the slice needed that the engine did not offer, and how each gap was closed.

Since job fw-F5 it builds on the framework's **plain** theme (Ronin's ink-washi stays in the Ronin repo). Ronin's site still hosts it at
`/games/cincinnatus/`, built from the pinned package.
