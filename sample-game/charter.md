# Cincinnatus, 458 BC: the game charter

Second-game slice for the Eraforge framework (job fw-F6, branch `job/fw-f6-cincinnatus`). Written from the setup interview (`claude/framework-setup-interview.md`) that Claude ran with Ash on 29 Oct 2026 in four rounds of multiple-choice questions. Each area records Ash's answer as he gave it (the option he picked, with its wording), then the rule it becomes. Where Ash did not answer, the area says **Open question** or **Agent's proposal (review at the first playtest)**, as the interview's rules require. Later jobs read this file, not Ronin's charter, for anything about what this game should be.

**Status: APPROVED by Ash, 29 Oct 2026 ("approved").** Open questions below stay open until asked.

Source of the story: Livy, *Ab urbe condita* 3.26–29 (the Aequi trap the consul L. Minucius at Mount Algidus; envoys find L. Quinctius Cincinnatus on his four iugera across the Tiber; his wife Racilia brings the toga; he is named dictator, orders every man to bring twelve stakes and five days' food, marches by night, rings the Aequi with a ditch and a stake wall at midnight while the army shouts; the Aequi, caught between the ring and Minucius' camp, surrender; Gracchus Cloelius and the Aequian leaders are sent under the yoke; Cincinnatus resigns on the sixteenth day).

## 1. Genre and kits

- **Hero:** a fictional farm youth, **Titus, 17**, a poor plebeian neighbour whose family's plot borders the Quinctian meadows. He works the fields with Cincinnatus, carries his stakes on the night march and fights at Algidus.
  Source: Ash, 29 Oct 2026, picked "Farm youth (Recommended): Fictional: a young neighbour who works the Quinctian meadows with Cincinnatus, carries his stakes on the march and fights at Algidus." and "Titus, 17: Same background, a year older; old enough to be called up with the levy."
- **Kits:** top-down exploration, turn-based battle, minigames. **Party:** the hero plus one ally in battle (the slice: Cincinnatus at Titus's stretch of the line).
  Source: Ash, 29 Oct 2026, picked "All three, Ronin's screen: Top-down + turn battle + minigame; 640×360 at 2×, 32 px tiles, high three-quarter camera; hero plus one ally in battle (Recommended for a slice)."
- **Loop and chapter structure:** the slice is one episode (farm → envoys → night march and stake wall → the breakout → the yoke → back to the plough). **Agent's proposal (review at the first playtest):** no repeating chapter template until a second episode exists.
- **Choices:** **Agent's proposal (review at the first playtest):** flags only (people's words and the Chronicle change; the historical outcome never does).

`game.json`: `kits: ["topdown", "battle-turn", "minigame"]`, `party.max: 1`, `hero`.

## 2. Screen

- 640×360 logical at 2× (art density 2), 32 px tiles, a character about 1.4 tiles; high three-quarter orthographic camera; key screens may break it.
  Source: the same answer as area 1 ("All three, Ronin's screen").
- Light: **Agent's proposal:** late-morning sun from the upper left for day paintings; the engine grades night (the march, the stake wall, the battle are at night).

`game.json`: `screen: { w: 640, h: 360, scale: 2, tile: 32, density: 2 }`.

## 3. History

- **Livy is the record.** Fiction only fills gaps; nothing contradicts Livy 3.26–29. Each job that writes story keeps a sources log (passage, what was taken, what was invented). Where modern historians doubt the story (it is partly legend, written some 400 years later), the Chronicle says so in a short note; the game itself never changes the events.
  Source: Ash, 29 Oct 2026, picked "Livy is fixed (Recommended): Follow Livy's account as the record; fiction only fills gaps; a sources log per job; doubts about the legend noted in the Chronicle."
- **Real people speak, with portraits and close-ups** (Cincinnatus, Racilia, the envoys, Minucius, Tarquitius, Gracchus Cloelius). Their words are invented where Livy is silent, and the Chronicle marks them as such ("Words invented; the deed is Livy's").
  Source: Ash, 29 Oct 2026, picked "Speak, with portraits: Real people talk and have portraits and close-ups; words are invented where Livy is silent, marked as such in the Chronicle."
- **Invented people** (Titus and anyone else) are marked as invented in their Chronicle entries.
- **Period limits (Agent's proposal, for the historian check):** early Republic, mid fifth century BC. No coins (bronze is weighed: the game's money is *aes*, rough bronze); no "SPQR" anywhere; no eagle standards, no lorica segmentata, no Imperial-era helmets; soldiers in the hoplite manner (round shields, spears, bronze helmets of the period); the dictator's lictors carry fasces (with axes outside the city); togas plain or with the magistrate's purple border; farm buildings of wattle, timber and thatch, not brick villas. The Aequi are an Italic hill people: spears, round or oblong shields, bronze disc breastplates; never drawn as savages.
- **Symbol rule for painted art (Agent's proposal):** no lettering, no logos, no real or invented crests on shields beyond plain geometric bands.

`game.json`: `history: { record: "fixed", source: "Livy 3.26-29", realPeople: "full", fictionMarked: "chronicle" }`.

## 4. Sensitive material

- Claude checks scripts against Livy and modern scholarship (a historian check, done by Claude, before each story job hands off). Enslaved workers may appear on neighbouring farms as part of the world, never as a mechanic, a reward or a joke. The Aequi are shown as people with their own reasons; the yoke is shown as the humiliation it was, not played for laughs.
  Source: Ash, 29 Oct 2026, picked "Historian check, slaves shown: Same, but enslaved workers appear on neighbouring farms as part of the world, never as a mechanic or a joke." (The "same" refers to the recommended option: "Claude checks scripts against Livy and modern scholarship; … the Aequi are shown as people with their own reasons, never mocked.")
- **Ruled out as mechanics:** scoring or rewarding forced labour; mocking the defeated.
- **Open question:** whether a named outside historian or classicist reviews before any public release (not chosen now).

## 5. Failure

- A lost battle offers **Try again** at once (from the start of the fight). A weak minigame result never blocks the story: the story goes on with a smaller reward.
  Source: Ash, 29 Oct 2026, picked "Retry; minigame never blocks: Lost battle: try again at once. A weak minigame result still lets the story go on, with a smaller reward."
- **Agent's proposal:** optional content never gates progress; giving up a lost fight wakes the party at the farm with half the bronze (the engine's game-over hook).

`game.json`: `failure: { battle: "retry", minigameBlocks: false }`.

## 6. Rewards

- Every reward is given **once** (the first result counts). Minigames may be **replayed for a best score that feeds nothing**. No grinding, no random encounters.
  Source: Ash, 29 Oct 2026, picked "Replayable for score: Rewards once, but minigames can be replayed for a best score that feeds nothing."

`game.json`: `rewards: { once: true, replayForScore: true, randomEncounters: false }`.

## 7. Side activities

- The **first** play of a minigame feeds a system (the slice: the night stake wall's quality sets how the breakout battle starts); replays are score-only (area 6).
- Sources: from the episode's own history (the stake wall is Livy 3.28).
- The slice's minigame is the **night stake wall**: plant stakes and dig in the dark, in rhythm with the army's shout, before the Aequi notice.
  Source: Ash, 29 Oct 2026, picked "Night stake wall (Rec.): The midnight ring at Algidus: plant stakes and dig in the dark, in rhythm with the army's shout, before the Aequi notice. Its result sets how the breakout battle starts."
- **Agent's proposal (review at the first playtest):** one to three minutes a sitting; Ash's playtest can cancel a minigame.

`game.json`: `minigames: { firstPlayFeeds: true }`.

## 8. Accessibility

- As Ronin: Story / Standard / Hard; timing aid Standard / Wide / Auto (Auto never reaches the top grade); battle speed; touch pad; control schemes; a contrast check before release.
  Source: Ash, 29 Oct 2026, picked "Same as Ronin (Rec.): Story / Standard / Hard; timing aid Standard / Wide / Auto (Auto never reaches the top grade); battle speed; touch pad; control schemes; contrast check before release."

## 9. Art

- **Who makes it:** every image by the ChatGPT app (Ash or its agent). Art layers (walkable ground, foreground cut-outs) never by code. Code draws only **marked fallbacks** until the art lands (the slice ships with them).
  Source: Ash, 29 Oct 2026, picked "Same, plus video loops" for "Who makes the art and the cutscenes?" (the base option: "Every image by the ChatGPT app (Ash or its agent); art layers never by code; code only draws marked fallbacks until art lands. Cutscenes staged in the engine with app stills for close-ups; no generated video.")
- **Style: painterly gouache** (style B in `art-prompts.md`): a soft, painterly digital illustration in the manner of a gouache background painting for an animated film; not pixel art. Chosen to test a second art style on the framework.
  Source: Ash, 29 Oct 2026: "you know what, just to test out a separate art style on the framework, lets go with painterly gouache since it's looking interesting!", after seeing the two samples he asked for ("can we try a sample of both 2 and 3?"; made by the ChatGPT agent, `art-handoff-phase1.md`).
- **Style anchor:** `sample_farm_B.png` (ronin-assets `outputs/cincinnatus/style_samples/`, SHA-256 `e9cf58db…`, kept unchanged), processed into the farm painting `area_farm` (`game.json` `art.anchor`). Every later prompt attaches it. Its known flaws, accepted for the slice: the distant temple reads Greek rather than Etruscan, and the far bank keeps some perspective.
- **To check at the first playtest (agent's note):** the engine was built around pixel art (scenes drawn at 1280 × 720, sprites and some layers scaled nearest-neighbour). Painterly art at that size may show stepped edges or soft sprites; anything found goes on the framework gaps list.
- **UI theme:** Ronin's `themes/ink-washi/` (F4's theme layer, 29 Oct 2026), fonts included, until a Roman theme is made (an open design job).

`game.json`: `art: { anchor: "area_farm", style: "painterly gouache" }`, `theme: "ink-washi"` (until a Roman theme).

## 9a. Front screen (title and its menu)

- **Open question: not asked.** Area 9a was added to the interview (PR #54, 29 Oct 2026) after this interview was run. What the slice does meanwhile (no rule): the farm painting behind `game.json` `title`, `subtitle` and `tagline` in Ronin's theme lettering, no progress tiers, Continue with the engine's summary. Ask at the next interview round, with the style samples (area 9).

## 10. Cutscenes

- Staged in the engine with the cinema layer; app stills for close-ups (inserts) and portrait cut-ins (real people allowed, area 3); **generated video allowed for loops** (water, fire), as in Ronin's water loops.
  Source: Ash, 29 Oct 2026, "Same, plus video loops" (area 9).

`game.json`: `cinema: { staged: true, video: "loops" }`.

## 11. Audio

- Suno for music (Ash), ElevenLabs for ambience and effects; period instruments (tibia, lyre, frame drum, cornu); instrumental; no AI voices. The slice uses silence and the engine's stand-in sounds until then.
  Source: Ash, 29 Oct 2026, picked "Suno + ElevenLabs, no voices (Rec.)".

## 12. AI disclosure

- Disclosed in the credits, with the tools named.
  Source: Ash, 29 Oct 2026, picked "Credits only: Disclosed in the credits, tools named."

`game.json`: `release: { aiDisclosure: { where: "credits", toolsNamed: true } }`.

## 13. Roles

- As Ronin: Ash approves by playing; Claude for engine, staging and scripts; the ChatGPT agent for images.
  Source: Ash, 29 Oct 2026, picked "Same as Ronin (Rec.)" for roles, spend and release.

## 14. Spend

- Estimate first; under $2 a run needs no extra yes once a job is approved; a batch over $5 needs a yes; spend logged in `claude/ronin-spend-log.md` (until the game has its own docs). Same answer as area 13.

## 15. Release

- Hosted inside Ronin's Vercel site behind the same password, at `/games/cincinnatus/`, with its own test page, until framework job F5 gives games their own repos and sites. Saves in the browser under the game's own key (`cincinnatus_save_v1`), separate from Ronin's. Same answer as area 13.

`game.json`: `saveKey`, `release: { host: "ronin-site", path: "/games/cincinnatus/" }`.

## Open questions

1. An outside historian or classicist before any public release?
2. The Roman UI theme (F4 makes it a `themes/<id>/` folder).
3. The front screen (area 9a): what the title shows, whether it changes with progress, who may appear on it.

## Changes

| Date | What changed | Why | Who |
| --- | --- | --- | --- |
| 29 Oct 2026 | First version, from the setup interview | Job fw-F6 | Claude, from Ash's answers |
| 29 Oct 2026 | Charter approved | Ash: "approved" | Ash |
| 29 Oct 2026 | Area 9: style decided, painterly gouache; sample B is the anchor and the farm painting | Ash: "lets go with painterly gouache" | Ash |
