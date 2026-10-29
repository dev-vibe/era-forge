# Setup interview: the question bank for a new game

Framework doc (job fw-F1, drafted 28 Oct 2026; pending Ash's approval). The `new-game` skill asks these questions before any art or code, and the answers become the game's charter (`charter.md`) and part of its `game.json`. The framework has no design opinions (Ash, 28 Oct 2026): nothing below is a default. Each area shows Ronin's answer **only as an example**, labelled as such; Ronin's full answers are in `claude/ronin-charter.md`.

Key names under "Lands in" are proposals for job F2 (`game.json`, content registry, mode registry); F2 may rename them.

## How to run the interview

1. **Before asking:** read the game's pitch (setting, period and place, who the hero is, the kinds of play the person imagines). If a charter already exists, this is a revision: ask only the areas being changed.
2. **One area at a time,** in the order below (later areas depend on earlier ones: failure and rewards depend on the kits; release depends on disclosure). Ask the area's questions together, then wait.
3. **Offer options, never a default.** Give the listed options (adapted to the setting) and say what each changes. Show Ronin's answer only if the person asks for an example, and say it is Ronin's.
4. **Record the answer verbatim** with the date ("Ash, 2 Nov 2026: '…'"), then restate it as a plain rule in the charter. If the person says "idk" or "whatever you think", propose an answer, record it as the agent's proposal with their words, and mark it for review at the first playtest.
5. **Unanswered or undecided** areas go in the charter as an **Open question** with the options; never fill them with a guess or with another game's answer.
6. **Write the outputs:** `charter.md` (one section per area: rules, source with the quoted words and date, `game.json` keys), the `game.json` keys, the style block (area 9) and any job-queue rows (reviewers, research, a style-anchor job).
7. **Log every change** in the charter's Changes table: date, what changed, why, who. A charter can be revised at any time; a revision that changes a `game.json` key is its own job with tests.
8. **Approval:** the person reads the whole charter and approves it in their own words; record the approval and date at the top.

---

## 1. Genre and kits

**Ask**
- What kinds of play does the game have? Which existing kits (top-down exploration, turn-based battle, minigames), and does it need a kind the framework lacks (side-scroller, visual novel, tactics map, something else)?
- What is the core loop, and is there a repeating chapter structure?
- Is there a party? How many fight or act together; who follows the hero on the map?
- Do choices change the world's outcomes, or only people's fates and flags?

**Options:** any subset of the kits; "new kit needed" (becomes a design job before production); party size 0 to N; choices as flags only / branching outcomes / branching endings.

**Why it matters:** the kits decide which modes register, which tools and tests the game gets, and which later interview areas apply (no battle kit, no battle failure rules). A new kind of play is a framework job, not a game job.

**Lands in:** `game.json` `kits`, `party`; charter (loop, chapter template, choice rule); job queue (any new kit).

*Example (Ronin's answer, not a default):* top-down + turn battles + minigames; a seven-step chapter template; Hayato plus two in battle, only Kichi on the map; choices are flags only.

## 2. Screen

**Ask**
- Logical resolution and art density (how many screen pixels per art pixel)?
- Tile or grid size, and how tall a character is in tiles?
- Camera: top-down, three-quarter, side view, isometric, first-person panels? May key screens break it?
- Light direction and time of day the art is painted in; does the engine grade light?

**Options:** 640×360, 480×270, 1280×720 logical; density 1 to 3; tile 16/32/48; camera as above.

**Why it matters:** fixes the canvas, the scene and sprite processors' sizes, the prompt wording for every asset and the acceptance checklist. Changing it later means reprocessing all art.

**Lands in:** `game.json` `screen`; style block (camera, scale, light lines).

*Example (Ronin's answer, not a default):* 640×360 at 2×, 32 px tiles, a character about 1.4 tiles; high three-quarter orthographic, about 45°; late-morning sun from the upper left.

## 3. History (or canon)

**Ask**
- Is the record fixed (fiction only fills gaps), may the game change history, or is the setting invented?
- May real people appear? Speak? Close up, with portraits? Only where they really were?
- How are invented people and invented details marked for the player?
- How are facts checked and sources logged? Any rule about what the hero knows when (knowledge never ahead of the hero)?
- Period limits for architecture, dress, objects and the game's frame (which period art style frames menus and maps)?
- Any symbol rules (crests, flags, religious marks, real logos) for painted art?

**Options:** fixed / alterable / invented; real people none / at a distance / full presence; fiction marked in-game / in credits only / not marked.

**Why it matters:** sets what the cinema layer may do with historical cast (portrait cut-ins, close-ups), whether the Chronicle shows a fiction mark, the `history-check` skill's checklist, prompt rules (symbols, period) and the acceptance checklist.

**Lands in:** charter; `game.json` `history`; cast data (`historical: true`); style block (symbol and period lines); job queue (sources log per job).

*Example (Ronin's answer, not a default):* history is fixed; real people only at a distance, never a portrait or face close-up; invented people marked as fiction in the Chronicle; crests only plain rings or bars.

## 4. Sensitive material

**Ask**
- Which subjects in this setting need care (violence against groups, slavery and forced labour, religion and persecution, colonialism, disability, living cultures and communities)?
- Who reviews scripts, art and music about them: historians, sensitivity readers, members or descendants of the communities depicted? At which step (design, script, before release)?
- Is anything ruled out as a mechanic (for example scoring forced labour, gambling, dialect played for laughs)?
- Whose agency does the story centre?

**Options:** no extra review / historian review / historian + sensitivity readers / community review; per-chapter decision; a list of mechanics ruled out.

**Why it matters:** adds review gates and reviewer rows to the job queue, constrains minigame and battle design, and decides tone. Past games about slavery were recalled or paused when this was skipped (see the framework plan, "New settings").

**Lands in:** charter; job queue (review steps and who); minigame rules.

*Example (Ronin's answer, not a default):* none named yet; an open question in Ronin's charter (Christian persecution, forced labour and executions in later chapters).

## 5. Failure

**Ask**
- Can the player lose a fight or a challenge? What happens then (retry from the start of the fight, return to a safe place with a cost, game over and reload)?
- Can any side activity or optional content block the story?
- Are tutorial fights unlosable?
- Can optional content (skills, lessons, side characters) ever gate progress?

**Options:** loss → retry / safe place with a cost / reload; minigames can or cannot block; optional content gates or never gates.

**Why it matters:** decides the battle kit's defeat flow, the minigame shell's result handling (game over or a weaker valid outcome), `noLose` defaults and the content checks that look for gates.

**Lands in:** `game.json` `failure`; charter.

*Example (Ronin's answer, not a default):* battles can be lost (Try again, or wake at a safe house for half the coin); minigames never block the story; optional content never gates.

## 6. Rewards

**Ask**
- Are rewards given once, or can they be earned again (replays, grinding)?
- Are there caps (prize money, fights against respawning foes)?
- Random encounters, collectibles, crafting, loot tables: in or out?
- How are resources (magic points, stamina) refilled?

**Options:** once only / once per sitting / repeatable with a cap / repeatable; random encounters yes or no; a list of loops that are out.

**Why it matters:** the item and reward systems enforce it (first-result or best-of-first-sitting, caps), it sets balance-simulator assumptions, and it tells content jobs what not to build.

**Lands in:** `game.json` `rewards` (and per-system caps such as `fugitive.winsMax`); charter (what is out).

*Example (Ronin's answer, not a default):* rewards once (first result or best of the first sitting), prize money capped, patrol fights capped at four; no random encounters, grinding, collectible counts or crafting trees.

## 7. Side activities

**Ask**
- Must every minigame, quest or side activity feed a system (stats, skills, trust, records, items, proof), or may some be score-only?
- How long may one sitting be?
- Where do side activities come from (the setting's own history and culture, invented, both)?
- Who playtests and can cancel one?

**Options:** must feed / may be score-only; length range; sourced from the setting / free.

**Why it matters:** the minigame kit's content check (a definition must name what it feeds), pacing targets in tests, and the `new-minigame` skill's design checklist.

**Lands in:** `game.json` `minigames`; charter.

*Example (Ronin's answer, not a default):* every minigame feeds something; one to three minutes; drawn from the chapter's own history; must pass Ash's playtest.

## 8. Accessibility

**Ask**
- Difficulty modes: how many, chosen when, changeable later? Which numbers change (enemy damage, health, healing after fights)?
- Timing aid for timed inputs: none / wider windows / automatic? What may the automatic setting achieve?
- Touch controls, controller, keyboard; key rebinding?
- Speed options (battle animation speed, text speed)?
- Text size, contrast and colour checks, captions for sound cues?

**Options:** 1 to 4 difficulties; timing aid levels; touch pad on / auto / off; each extra aid yes or no.

**Why it matters:** the settings system builds its menu and saved config from these; the battle and minigame kits read the windows and auto rules; tests run each mode.

**Lands in:** `game.json` `difficulty`, `accessibility`; charter.

*Example (Ronin's answer, not a default):* Story / Standard / Hard with a multiplier table; timing aid Standard / Wide / Auto (Auto never reaches the top grade); battle speed Normal / Fast; touch pad.

## 9. Art

**Ask**
- Which style, and what is the style anchor (one approved image every prompt attaches)? This is the first art job: draft, approve the anchor, then write the style block.
- Who makes which layers: the image model, the person in the app, hand-written code? May code ever paint art or stand-ins?
- Which image tools, and which are paid?
- How is animation made (few poses plus engine motion, sequential sheets, video loops)?
- UI theme and fonts.
- Rules for originals (never resized in the app; keep downloads) and for people in paintings.

**Options:** model + app only / model, app and code / hand-drawn by an artist; anchor image chosen now or by a first art job.

**Why it matters:** writes the style block pasted into every prompt, the acceptance checklist, the theme the UI loads, and which pipeline steps exist (painter pages, mask tools, video loops).

**Lands in:** style block (doc); `game.json` `theme`, `art.anchor`; charter (who makes which layers); job queue (style-anchor job).

*Example (Ronin's answer, not a default):* the well square is the anchor; art layers only by the image model or Ash in the app, never code; ink-on-washi UI.

## 9a. Front screen (title and its menu)

**Ask**
- What does the title show: a painted key screen, a staged scene, plain lettering? Is the lettering text or a made image (brush, carved, printed)?
- Does it change with the player's progress? If so, which moments change it (first launch, mid-chapter, a chapter's end), and what changes (light, weather, season, who stands there)?
- Who may appear on it, and by which rule? Use the same rule the game uses in play (who travels with the hero), never a separate one.
- Which items does the menu offer (Continue, New, Settings, Credits, a disclosure line), and what does Continue's summary show (place, objective, level, play time, date)?
- What mood should it set, and which music plays? The light should suit the track.

**Options:** still painting / painting with grades by progress / staged scene; text lettering / generated lettering; summary fields as listed.

**Why it matters:** decides the title art set to commission (background, figure layers, lettering, paper), the progress tiers the title hook returns, the save fields the summary needs, and the title's playback page if it moves.

**Lands in:** `game.json` `titleArt` (layer ids), `subtitle`, `tagline`, `music.title`; `GAME_HOOKS.titleTier` (the game's tiers); charter (who may appear, and why).

*Example (Ronin's answer, not a default):* a river-road painting with Hayato from behind; light by save (pre-dawn, morning, day); Kichi beside him only while he is following; brush wordmark and carved seal; Continue shows place, level and play time. Details: `claude/ronin-title-screen.md`.

## 10. Cutscenes

**Ask**
- Are story scenes staged in the engine, generated video, pre-rendered, or a mix?
- Close-ups: painted stills, portraits, none?
- Where may generated video be used at all?
- Staging rules: does the scene play where the player stands? Must camera and letterbox be released before choices and battles?

**Options:** staged in engine / video / mix; close-up method; video for loops only / for scenes / never.

**Why it matters:** decides whether the cinema layer and its grammar are used, which tools and spend apply, and what `cinema_test` checks.

**Lands in:** `game.json` `cinema`; charter; cutscene playbook choice.

*Example (Ronin's answer, not a default):* staged in the engine; app stills for close-ups; video only for water loops.

## 11. Audio

**Ask**
- Which tools for music, ambience, sound effects and voice? Who generates music?
- Sound identity: period instruments, modern elements, vocals or instrumental only?
- Dynamics: how quiet is exploring music; where are the big moments?
- Voices: none, human actors, AI voices?
- Rules for prompts (never name a composer or existing piece?).

**Options:** per channel: a named tool / a person / none; voices none / human / AI.

**Why it matters:** sets the audio pipeline and spend, prompt templates, and whether the engine needs voice playback and lip or text sync.

**Lands in:** charter; audio prompts doc; `game.json` `audio` if voices are used.

*Example (Ronin's answer, not a default):* Suno for music (Ash), ElevenLabs for ambience and effects, Edo instruments, instrumental only, no AI voices.

## 12. AI disclosure

**Ask**
- What AI-made content will the game contain?
- What is disclosed, in what words, and where (title screen, credits, store page, website)?
- Are tools named?

**Options:** title + credits / credits only / store page + credits / decide at public release; tools named or not.

**Why it matters:** store rules (Steam requires disclosure of AI-made content), player trust, and a credits or title screen the release job must build.

**Lands in:** charter; `game.json` `release.aiDisclosure` (where, text).

*Example (Ronin's answer, not a default):* disclose plainly; where and how is still open in Ronin's charter.

## 13. Roles

**Ask**
- Who designs, writes, codes, makes art, makes music, approves?
- Which agents work on the game (Claude, the ChatGPT/Codex agent, others), and how does work pass between them (branches, handoff prompts)?
- How is approval given and recorded?

**Options:** per role: a person / an agent / a split by kind of work.

**Why it matters:** the `next-job` skill routes work and writes handoff prompts from this; approval gates come from it.

**Lands in:** charter; job queue (owner column).

*Example (Ronin's answer, not a default):* Ash approves by playing; Claude for engine, feel and staging; the ChatGPT agent for images and standard mechanics.

## 14. Spend

**Ask**
- Which tools cost money, and whose accounts pay?
- What may an agent spend without asking (per run, per batch)?
- Where is spend logged?

**Options:** no paid tools / a per-run and per-batch limit / every spend needs a yes.

**Why it matters:** agents must state costs and stop at the limit; skills read the limits.

**Lands in:** charter; spend log in the runbook.

*Example (Ronin's answer, not a default):* estimate first; under $2 a run needs no extra yes once the job is approved; over $5 a batch needs a yes.

## 15. Release

**Ask**
- Where is the game hosted, and who can play it (public, password, invited accounts)?
- Review pages: a test hub, jump buttons, practice saves?
- How do saves work (browser storage, file transfer, cloud) and what is the save key?
- What is a release (per chapter, per version), and what must pass first?
- Any public release plan (store, platform, age rating)?

**Options:** host; access model; save model; release unit.

**Why it matters:** the site builder, password gate, test-hub catalog, save key and release skill come from these.

**Lands in:** `game.json` `title`, `saveKey`, `release`; hosting doc.

*Example (Ronin's answer, not a default):* Vercel with a shared password, previews behind Vercel login; test hub; browser saves with file transfer.

---

## Not asked (framework conventions)

The interview does not ask about tests on the test clock, one branch per job, merging and re-testing before handoff, never publishing unpushed code, recording approvals, raw art in the game's assets repo, or animation playback pages: every game follows these.
