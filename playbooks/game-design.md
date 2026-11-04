# Game design playbook

Framework doc (4 Nov 2026). What making Ronin taught about designing and producing a game with AI agents, gathered from its charter,
runbook, design docs, art and cutscene playbooks, the lessons logs and the archive, and written so any game on Eraforge (or any other
engine) can use it. Each lesson is a rule plus the reason it exists; most were learned through a rework, a playtest rejection or a bug.
It is also a claude.ai skill (`game-design-playbook`); change both together.

The framework holds no design opinions, and this playbook does not change that. Two kinds of content are mixed below, and they must not be confused:
- **Craft and process rules** apply to every project (testing, hand-offs, art pipeline, staging, readability mechanics).
- **Design positions** are one game's answers, Ronin's (no farming, history fixed, three difficulties, and so on). They are proven options, not defaults. Offer them when the person is deciding. Never impose them on a game whose charter says otherwise.

## 0. First moves on any game project

1. **Find the game's rules before touching anything.** Look for a charter, design doc, runbook or status file, and read it first. Where docs disagree, the newest approved decision wins, so fix the older doc when you next touch it.
2. **No charter yet? Run the setup interview** (`playbooks/setup-interview.md`, the `new-game` skill; summary in section 1) before making any art or code.
3. **Settle what you will deliver and how the human will review it** (a playable link, a review page, a PR preview). A feature with no review surface is not done.
4. **Do everything you can yourself.** Ask the human only for what you truly cannot do, and say why. Never ask them to save a file, move an attachment or run a command you could run.

## 1. The setup interview and the charter

The engine or framework carries no design opinions. A game's design rules are that game's answers to an interview, saved in its charter.

**How to run it**
- Go one area at a time, in dependency order (failure and rewards depend on the genre; release depends on disclosure). Ask an area's questions together, then wait.
- Offer options and say what each one changes. Never give a default. Show another game's answer only if asked, and label it as theirs.
- Record the answer word for word with the date ("Name, 2 Nov: '…'"), then restate it as a plain rule.
- If the person answers "idk" or "whatever you think", propose an answer. Record it as your proposal with their words, and mark it for review at the first playtest.
- An undecided area becomes an Open question with its options listed. Never fill it with a guess or with another game's answer.
- Log every change in a Changes table (date, what, why, who). Get approval of the whole charter in the person's own words.

**Areas to cover**
1. **Genre and kits:**
   - kinds of play and the core loop;
   - a repeating chapter template, if there is one;
   - party size, and who follows the hero on the map;
   - whether choices change outcomes or only flags.
2. **Screen:** logical resolution and art density, tile size, character height in tiles, camera angle (and whether key screens may break it), light direction. Changing any of this later means reprocessing all the art.
3. **Canon or history:**
   - is the record fixed, alterable or invented;
   - real people: none, at a distance, or close up;
   - how fiction is marked for the player;
   - knowledge never runs ahead of the hero;
   - period limits;
   - symbol rules for painted art.
4. **Sensitive material:** which reviews happen, any mechanics ruled out, whose agency the story centres.
5. **Failure:** what can be lost, what a loss costs, and whether side content can block the story.
6. **Rewards:** repeatable or once only, caps, and what kinds of content the game will never have.
7. **Side activities:** must each one feed a system? Length per sitting.
8. **Accessibility:** difficulty tiers, timing aids, control schemes, rebinding, captions, contrast, touch.
9. **Art:** the style anchor image, the style block, who makes art, the art layers.
10. **Front screen:** what it shows. It must follow the same rules as gameplay.
11. **Cutscenes:** in-engine or video; set pieces.
12. **Audio:** which tool makes what; the sound identity; voices or none.
13. **AI disclosure.**
14. **Roles:** who decides, who makes which assets, which agent does which kind of work.
15. **Spend:** per-run and per-batch limits.
16. **Release:** host, access, saves, the release gate.
17. **Text voice and readability:**
    - reading age and grade limits;
    - sentence and box budgets;
    - the policy for setting terms and spelling;
    - a voice and humour table with its "never" list;
    - layout: size, paging, highlight, key caps, text speed.

    Ask this area early. It is not yet in `setup-interview.md`; its proposed questions are in `playbooks/lessons.md` (text-pass). Ronin had to add it later, as an engine change.

A charter answer that changes engine behaviour should become a config key the engine reads (e.g. `failure.minigamesCanBlockStory: false`). A content check can then enforce it, for example "a minigame with no `feeds` entry fails the build".

## 2. Design positions that worked (options to offer)

### Scope and the core loop
- **Aim for density, not length.** A chapter should feel full, not long. Most players never finish long games.
- **Keep a written "not doing" list** so later agents don't drift back to filler. One game's list: collectible counts, crafting trees, random encounters, grinding, fetch quests with no person behind them, a card game.
- **Every side activity feeds a main system** (a stat range, a technique, trust, a codex entry, a keepsake, a proof), or it is cut. A minigame that only gives a score is filler.
- **Revisit changed places.** The cheapest strong content is an old place in a later year: variant art of the same painting, with changed people. Matched camera framing lets the echo land without a word.
- **New verbs multiply old spaces.** A new field ability (reach, shove, sing) opens secrets in every map that already exists.
- **A chapter template plus one signature mechanic.** The template can repeat (arrive, requests, evidence, boss, liberation, road, return). Each chapter adds one mechanic from its own setting, built on a system that already exists.
- **A themed chapter still needs the full genre loop around its spine:** exploration, fights, levelling, puzzles, minigames. The theme is the arc, not the whole chapter.
- **Make the resolution visible in the world:** prices drop, new people appear, the light changes.
- **Lead with what your art pipeline does well.** Plan around variants of approved images and sheets with few poses; let the engine supply motion.

### Rewards and failure
- **Pay out once** (the first result, or the best of the first sitting). Replays are for score and a line of dialogue ("Practice complete. No second reward."). Cap repeatable fights and prize money.
- **Earn the battle resource inside the fight;** don't refill it after a win. This stops players hoarding it.
- **Losing is cheap.** "Try again" restores the fight as it began. A softer option (wake at a safe place) costs a fair share of coin.
- **No side activity can block the story.** A low result gives a weaker but valid outcome and a warm line, never a game over. A failed persuasion just breaks up ("Tomorrow, then") and can be retried.
- **Optional content never gates.** Companion skills are alternatives; every route has a solo path. Never tie essential recovery (the only heal) to a missable moment.
- **Optional practice bouts are sealed off.** Snapshot HP, resources and the pack, run the bout, then restore exactly. A win, a loss, a concession and a mid-bout save must all leave the state coherent.

### Combat and timing
- **Put the skill input on the player's own attacks; make defence a reading decision** (read the enemy's intent, choose Guard, a posture break or a kill). Few inputs, many decisions.
- **Add a posture or stagger bar beside HP.** Breaking it cancels the enemy's queued action and opens a damage window, so reading heavy attacks pays.
- **Timing windows.** An early press locks you out (no mashing). Timestamp input at the key event, not the next frame. First versions are always too strict and too fast, so widen them.
- **Give each optional opponent one learnable pattern,** explained in the offer and rewarded with a technique. After a stagger, reset to a readable move: never an unannounced heavy.
- **Teach target order through the encounter's shape:** a fragile leader with a sturdy guard, or an enemy who destroys a visible objective each turn until he is dealt with.
- **Show objective threats in the world** (lanterns knocked down; the survivors light the next act) instead of an abstract meter.
- **Fun is flair, not numbers.** The verdict "not enough fun or flare" was fixed with motion alone. Damage and timing stayed the same. The motion added:
  - a gather, then a dash;
  - recoils and visible dodges;
  - hitstop scaled by hit quality (about 3/5/8/12 frames);
  - impact frames and a camera punch.

  Show misses as near misses. Never pop a "+0".
- **Telegraphs can be stripped later.** Start with heavy telegraphs, and remove labels once the art carries the cue (a red glow, the wind-up).
- **Fight where you stand.** Ordinary fights happen on the scene where they started, at the scene's scale. Save dramatic transitions for bosses.
- **Simulate before retuning.** Thousands of simulated runs showed several proposed changes moved nothing that mattered. Simulate input strategies too: a perfect reader, a 60% reader, a masher. The masher must never win.

### Difficulty and accessibility
- **Three tiers, changeable at any time.** Each tier scales enemy attack, HP and posture, plus recovery after a fight (all / about 25% / none).
- **Keep the timing aid separate from difficulty** (Standard / Wide / Auto), and make every timed input in the game honour it.
  - Auto lands a mid grade, never the top grade, so skill still pays.
  - Hard can take cues away (no ring, a glint only, clear feints).
- **Story challenges scale with the tier.** The gentle version on the easiest tier, the bite on the others (e.g. one attacker, then two, then two tougher). Measure the results per tier.
- **Feints: Hard tier only, and unmistakable** (shake, colour, sound). Name a late press ("Too late!") instead of silently counting it as no answer.
- **Control schemes in two tiers.** First an obvious Arrows / WASD / Controller choice, with Auto that follows the last device used, and hints that name the player's own keys. Build per-action rebinding only where a mechanic needs a chord.
- **Captions** become a setting once there is speech.
- **Contrast-check every UI string** (WCAG AA) on every screen variant, images with text included. Flag AA misses for the human's OK and record the OKs. Block only unusable contrast.

### Teaching and progression
- **Teach a technique through an encounter that shows the need,** hands over the move and lets the player use it at once. A failed pilot granted an area attack after a one-on-one spar, where you could neither use it nor see what it was for.
- **Keep a level-up fallback,** whichever comes first, so nobody misses it and nobody gets it twice.
- **Lesson offers can be declined and come back** (Spar / Just tell me / Not now).
- **Check that triggers fire on the real game path.** One lesson hook fired only on a legacy fight path, and its test passed because it used that path too.

### Minigames
- **The rules:**
  - it feeds something;
  - it can't block the story;
  - it pays out once;
  - one to three minutes a sitting;
  - it honours the timing aid;
  - with no input at all it still finishes, at the worst tier.
- **Build one shared shell before the second minigame.** It saves and restores game state and music and shows one result card. Shared rhythm and timing cores carry skills across.
- **Reuse the combat vocabulary** (read the opponent, posture, release timing).
- **A meter is not a mechanic.** "Press while watching a bar" was rejected. The rebuild made each press one bellows stroke, made the tempo set the heat, and turned the glowing steel itself into the gauge.
- **Readability pass for games about reading an opponent:**
  - a move chart;
  - a slow guided first bout where a wrong key repeats the move;
  - answer hints for the first beats;
  - a habit that changes over the bout.
- **Show progress in multi-round events** ("Found: 1 of 3"), and warn before an action ends the event.
- **Comedy minigames may be rigged** so the mechanic serves the joke.
- **Kill mechanics that fail playtest instead of tuning them**, remove anything that depends on them, and never gate a chapter on an unproven minigame.
- **Don't place a minigame where it breaks the mood** (no festival game on a race to an execution).

### Exploration, travel and encounters
- **Mark every interactable with one consistent symbol,** shown only when it can be used.
- **Staging matters even in exploration:** nobody pops in (companions walk out and back), animals trot off rather than vanish, speakers are visibly present. Motions under about 3 screen pixels are invisible, so make them about 20.
- **Probe reachability for every hotspot,** and give scripted walks a stall cutoff.
- **A travel stop is play, not a montage:**
  - arrive and get your bearings;
  - interactions that stay available until used (reading costs nothing);
  - one situation with two or more approaches;
  - the consequence shown on the spot plus a lasting flag;
  - departure as its own visible action, which warns about anything unfinished.

  Asking a question must never silently end the visit.
- **No arbitrary action budgets** like "two actions per stop".
- **Never put a place card on empty road;** cut interactions that have no consequence.
- **Authored encounters instead of random ones:** discovery opens more options, there is always a non-fighting and a solo route, and the result carries forward.
- **Offer a route fork only when both branches have their own content.**
- **The map is the travel screen:** a clear "you are here" pin, the destination always named, current / next / visited states. Use one map at two zoom levels, joined by a wipe, so the pin never jumps. Put fog of war over sea and edges only, never over places of interest.
- **Transitions:** fade, hold on the destination name, fade in, with input held. Never cut abruptly.
- **Borrow structure from other games, not their systems.**
- **Prototype one complete slice and playtest it before building the rest.** Passing tests proves the design works, not that it is enjoyable.

### Evidence, puzzles and the codex
- **Knowledge is progress.** Build a chapter on a lie on paper that the player disproves with proofs collected in the codex. In the payoff scene, the player answers each objection with the matching proof.
- **A wrong answer gives a specific hint and the question again,** at the cost of a small "nerve" resource. It never locks the player out.
- **Vary the evidence type each chapter,** and make sure old proofs can't satisfy new gates.
- **A codex entry records only what the hero knows at that moment.** An audit found leaks: future events, one clue implying another, the author's research notes in the in-world journal.
  - Each fact needs its own unlock.
  - "Confirmed" needs two independent sources.
  - Old saves assume less.
- **Open questions are entries too,** removed when answered, which makes the codex a quest log.
- **"Unlock everything" review shortcuts hide knowledge leaks.** Snapshot early story points, and test the codex text at each milestone.
- **Notices ("Recorded") never block play.** Batch them per scene and wait until dialogue finishes. A changed entry shows "revised" until it is read again.

### Feedback and presentation
- **Tiered reward moments:**
  - a small pickup is about 1 s and never blocks movement;
  - a notable one is a card with the stat change ("Attack 5 → 14");
  - a story item gets a short ceremony;
  - handing an item over plays the animation in reverse.
- **A front screen reads the save but never loads it,** and decides who and what to show by calling the game's own rules.
- **Expect taste feedback in feel words** ("too fast", "abrupt", "feels weird"). Give yourself knobs to tune by ear, and default to more motion and impact than feels necessary.

## 3. Set pieces and cutscenes

- **Stage story scenes in the engine with approved art.** Do not use generated video for them. Video models redraw the whole frame: still things drift, and better prompts barely help. Keep generated video for loops where the motion is the content (water, fire, smoke), or at most one close-up between two approved keyframes.
- **Build one shared film grammar** of script steps and reuse it everywhere:
  - letterbox (dialogue becomes subtitles);
  - eased camera moves to a point or a person;
  - a memory grade;
  - a walk that continues under dialogue;
  - an off-screen voice;
  - a cut-in band;
  - close-up stills.
- **Write a beat sheet before the script.** Use 5–12 beats, one image each (who, where, what changes), with at most one beat marked for a close-up. Find coordinates on a grid over the art. Shoot a contact sheet and fix the framing before the timing.
- **Stage the scene where the player pressed the button.** The NPC turns and takes a step; the hero steps beside them on the side he came from. Walking people to fixed marks feels unnatural.
- **Framing:**
  - two-shots side by side and facing, never stacked vertically;
  - newcomers enter on the side away from the player;
  - aim the camera above the feet, because letterbox bars hide the edges;
  - keep zoom in the range where the art stays sharp.
- **Timing:**
  - camera moves of about 1.5–2 s;
  - open on a held close shot, then pull back;
  - a 20–50 frame pause before the key line does more than any effect;
  - one idea per box, and silence is a beat.
- **Show it before saying it.** If a line says someone turns, show the turn first. Let the player see danger before the game names it.
- **Always hand control back explicitly:** bars down, camera released and grade cleared before any choice, fight or scene end, and on interruption too. Test this automatically.
- **Check foreground cut-outs and walk masks before choosing marks.** A figure "under the tree" vanishes behind the canopy layer.
- **Scene lights follow the zoom.** Drive flicker from one smoothed random value; a sine wave looks mechanical.
- **Strip animation and engine motion add up.** If the strip already turns the body, reduce the scripted rotation. After a pose hand-off, check that every pose is actually reached in the script.
- **Set pieces:** a few per chapter, scripted in the engine, where play and story hand over without a cut.
  - A fight or minigame starts inside the scene and hands back into it, carrying what happened.
  - Choices are made by doing: walking into the line means fight, staying means witness, with a gentle push-back so it is deliberate.
  - Music reacts to what happens.
  - Branches feel different and neither is punished.
  - Build first the set piece whose parts already exist.
- **Close-up stills:** make the key frame first, then make its neighbours by editing the approved image ("keep everything exactly, change only the hands"). Three keyframes, dissolves and a slow push read as animation. A still whose image is missing must be a no-op, so scripts can reference art that doesn't exist yet.

## 4. Player-facing text

### Readability (without softening)
- **Measure before rewriting.** A script lists every string with its file, speaker, reading grade and box count in the real font. Problems cluster: in one game, examine texts were a third of all words and held most of the long sentences.
- **Example limits:** most lines at grade 6 or below; lore at grade 7; sentences about 10 words, none over 20; one idea a sentence.
- **Grade scores don't see names.** Cap new proper nouns at two per box.
- **Readability is not softening.** Keep every death and hard fact, said plainly. The usual fix is splitting a sentence, not cutting content. To shorten, drop decoration and keep the facts the story needs.
- **Plain words, but keep the setting's flavour words.** Explain each one once, inside the same sentence, at its first use ("tamahagane, raw sword steel"). Never a footnote, never twice. Explain a chapter's key word wherever the player is likely to meet it first.
- **One spelling everywhere, decided by a rule.**
- **Skill and item text says what the thing does,** with the number ("Draw and cut in one stroke. 1.8× damage.").
- **Put directions in their own sentence,** and highlight the place.
- **No developer notes in player text,** and check failure-only fallback strings against the story too.

### Layout and pacing (engine-level, so writers don't fight it)
- **Page boxes at sentence ends; break a long sentence at a clause; show "1/2".**
- **Budgets:** a story line takes one box, an examine text at most two, a tutorial one instruction a box.
- **Text speed Normal / Fast / Instant,** with a short beat (about 8 frames) after each sentence end and each "...", so jokes and silences land.
- **One highlight style** for names, places and quest words: on first mention only, at most two a box, none in grief scenes.
- **Key hints are drawn key caps of the player's current scheme,** in one format everywhere ("Z Read").
- **Choices:** the safe or cancel option goes last (the B button picks it), and unselected options stay readable.
- **Text size:** subtitles never smaller than the dialogue they replace. No list row is ever cut off by a panel edge.
- **Keep plain text beside the markup** so tests that read strings keep working.

### Voice and humour
- **Write a voice table:** each character's voice, and where their humour comes from (care disguised as complaint, a child's logic, deadpan understatement, blunt verdicts). Say what each character never jokes about. Villains get none.
- **Humour rules:**
  - it comes from character and situation;
  - the turn comes last, after "..." or in its own box;
  - at most one joke an exchange, and it must reveal something about the person;
  - a scene that turns serious stays serious.

  **Never:** modern slang, pop culture, winks at the player, puns for their own sake, anachronisms, jokes inside grief.
- **Replace empty reactions ("Ha!") with a concrete image from the setting,** ideally one the player already knows.
- **Check jokes for facts too.** Fix the fact and keep the joke.

### Canon and history method
- **Check facts before scripting, and log each claim:** the claim, a verdict (supported / uncertain / legend / not recorded), what the game may say, and the sources actually opened. Separate "found a lead" from "read the passage". Record disagreements between sources instead of picking one.
- **Watch for later material passed off as period material.** Later distance tables, modern markers and date arithmetic from an anchor are not proof of an earlier event.
- **If a detail can't be verified, show less rather than invent it** (no weather, unnamed officials, charred timbers instead of smoke).
- **Fit fiction around a fixed record** with dated title cards for the hero's own days, undated rumours, and clearly invented people. Label legends as legends.
- **Real people at a distance** if the charter says so (no portraits or close-ups; only where they really were).
- **Ban symbols the model would invent** (crests, pseudo-writing).
- **Urgency is narrative only** on a fixed-outcome path: no timers and no speed rewards.

## 5. Art from image models

### Who makes what
- **The image model (or the human) makes every pixel of art.** Code may only key, crop, scale, register, pack, light and add particles. Hand-coded fixes to art layers (walk masks, foreground cut-outs, broken frames) kept failing. A broken frame is regenerated, never patched by code.
- **Build the engine side first, with fallbacks,** so the game runs with every asset missing. Then commission the art. Use a switch to turn new clips off, and keep the approved old art as the baseline.
- **Keep the master and the runtime asset separate.** Archive the untouched original with its hash, exact prompt and reference order. Derive the game asset with a re-runnable script.
- **Never resize or "pixel-fix" in the generating app.** Models ignore requested sizes (2048² came back as 1254²), so treat a requested grid as a layout guide, not as data.

### Prompting
- **One fixed style block opens every prompt, plus one canonical style reference image.** The block covers pixel density, outlines, palette restraint, light direction, period, and bans (no people in scenes, no text, no UI). It ends with "deliver exactly as generated; do not resize or post-process."
- **Attach references in a stated order and name each one's role** ("image 1 = style, image 2 = this character's approved sheet").
- **Describe how things look, not their function or how they're tied.** "A club through the sash" became two swords; "thick wooden club, iron studs, no blade" worked. Name the props that must be absent.
- **Put age and build in the face and in numbers.** Use face cues such as jaw, lines and grey strands, plus height in tiles relative to the hero. "38 years old" alone gave a girl's face.
- **Portrait first, then the sheet,** with the portrait attached ("the sprite must be this same person").
- **Walk cycles:** "left/right leg forward" means nothing in profile. Say "short stride, feet one shoe-length apart; column 2 the near leg forward". Ask for a failing row alone as a strip.
- **Variants and following frames are edits of the approved image,** naming what must not change. "Create the frame before" redraws everything. If edits start to drift, regenerate the whole sheet.
- **After a near miss, add a one-line "Critical detail" to the prompt.** It usually fixes the defect in one reroll.
- **Required text or glyphs:** attach a reference rendered from a real font and compare stroke by stroke. Stop after 3 failures and report.
- **Design levels inside the prompt.** Give the size in tiles, every exit edge, the open areas in tiles, the light per region, focal points and water rules. Review the draft against a numbered checklist taken from the prompt.
- **Draft cheaply, then do a high-res pass** with "keep its composition exactly" and the draft attached.
- **Make layered compositions as separate pieces,** each attached as reference to the next, so they can be graded and changed later.
- **Expect moderation false positives;** log failed attempts and never fabricate a result.

### Keying, slicing and layers
- **Sprites go on flat magenta (#FF00FF), with "no magenta in the figure".** "Transparent" output leaves fringes. Key with a tolerance and despill.
- **Ink and dry-brush art goes on white,** keyed by darkness (alpha = 255 − luminance).
- **Find figures as connected shapes,** not by the grid. Demand wide gaps, and count shapes against the expected frame count.
- **Use one scale per clip,** set from frame 1 against the approved standing height. Anchor on a meaningful point (the planted foot). Measure tool tips and contact points per frame and give them to the engine as data. The cell size equals the existing pose cell.
- **Walk mask:** a model edit of the approved painting into two flat colours at the same size. Keep it to two colours, because an unused third colour pinched a path to 6 px. The human audits it in a paint-over tool.
- **Order: walk mask first, human audit, then the foreground layer.** Explain the foreground's purpose to the model ("drawn on top of the hero; keep only objects with walkable ground behind them, up to a person's height") and attach the audited mask.
- **Cut the painting and every layer from the same original through the same resize.** A re-rendered painting differed in about 6% of pixels, so cut-outs visibly shifted. After re-cutting a layer, rebuild everything that embeds it.
- **Anything painted that moves or disappears needs a clean plate** of what's behind it. For small patches, edit a crop, paste it back with a feathered mask, and verify that zero pixels changed outside the mask.
- **Keep PNG as the alpha master.** Verify the decoded output, not the in-memory composite.

### Animation
- **Rank animation work by screen size × how often it's seen.** One audit marked almost everything High and missed the walk cycle. The biggest win was a plain pose sheet for enemies still faked with tilted walk sprites.
- **Readability floor:** below about 50–70 px tall, only body, weapon and weight read. Hand-level beats become close-up stills, never sprite strips.
- **Use few drawings** (6–10 per action, 3 keyframes per insert), and let the engine hold frames to the phase length. One clear action per clip. Split clips where player input intervenes.
- **Map clips to engine phases (windup / lunge / contact / recover), not a fixed clock,** so damage timing, fast mode and hitstop stay intact.
- **Frame 1 copies the approved ready pose, and the last frame returns to it.** State the facing twice; draw one side and mirror it. Define the loop seam or the held end state.
- **The engine owns travel, timing, particles, light, text and moving props.** Never bake travel into a sheet and also move it in code. Never draw a prop the engine also moves.
- **Keep in code:** particles, sparkle, fog, day and night, UI motion. Whole landscapes or crowds on one animated sheet fail.
- **Roll out in waves:** a pilot that proves the slicer and player, then the next wave only after approval at native size. Know when to stop (a 6-frame walk was dropped after 5 attempts).
- **Recurring model failures to check:**
  - duplicate weapons, or a prop switching hands;
  - floating props;
  - extra limbs (trace each limb from shoulder to hand; don't count hands);
  - cells crossing boundaries;
  - identity drift.

  For each defect decide: accept, play a subset of frames, or drop the clip.

### Water and environment
- **Water loops from a video model:**
  - the same crop as start and end frame;
  - static camera, 4 s, low resolution, silent;
  - a negative prompt for droplets and ripple rings.

  Then mask to the water, snap to the painting's palette, rebuild the pixel grid, drop to 12 fps, and cross-fade the seam.
- **Choose a model with an end-frame input that doesn't recompose the frame.** Price-check settings first; the low settings cost about a third.
- **Judge procedural shimmer by eye, not by numbers.** Pixel-change tests passed while the human saw nothing. What worked: sparse glints anchored to bright pixels already painted in the water.

## 6. Audio

- **A music model for songs, a sound-effects model for ambience and one-shots;** keep a procedural fallback for every effect. Take 2–3 takes per effect and randomise between them.
- **Music prompt structure:**
  - genre, use, BPM and mode;
  - instruments with playing technique;
  - mood;
  - constraints ("same few layers throughout, no build, loopable");
  - a long Exclude list.

  Never name a composer, game or existing piece.
- **Exploration music is low-key:** flat dynamics, the same 3–4 layers, room for dialogue. Big dynamics only for battles and story moments. Ask the music's mood before setting a front screen's light.
- **Loops:** find bar-aligned points with matched levels, bake a short crossfade (about 120 ms), and keep the intro as a play-once part.
- **Loudness by role:** about −16 LUFS for battle and title, −19 for the field, −20 for quiet interiors.

## 7. Engineering

- **Deterministic test clock.** The test steps frames itself, gameplay randomness is seeded, audio uses its own random source, and nothing waits in real time. This cut one suite from 747 s to about 160 s and removed most flakes.
- **Keep loops inside the page** ("step until condition, at most n frames"); every browser round trip costs CPU. Only a few real-clock tests (audio, a boot smoke test), and they wait for a state with a time limit, never a fixed sleep.
- **Test tiers:** a quick group after every change, the full group before merge, plus the test of the area you touched. Tests run in warm reused workers, so they must not depend on a fresh process.
- **Named test jumps** (start straight into a moment) are shared by tests and by the human's review hub.
- **Prove a test can fail.** Break the rule on a scratch branch. Turn tests that only print into assertions, and delete checks that cannot fail.
- **Prove refactors with pixels.** Shoot every screen and effect moment on main and on the branch, then compare pixel for pixel. For framework upgrades, checksum every built file on the old and new pin, and explain each difference.
- **Generate per-scene checks from scene data:** every exit and hotspot reachable, no stuck positions, hotspot coverage (a floor hotspot showed the "?" from 90% of a room).
- **Flaky tests print their state on failure.** Use relative or percentile performance bounds, never absolute times. When a test fails, run it on clean main before blaming your change.
- **Release extras:** a full playthrough on the test clock, the opening on the real clock, and the contrast check.
- **Framework vs game.** Extract a framework from a working game inside its repo first, with the existing tests guarding it, and keep the built output byte-identical.
  - The core never names game content: use registries for modes, steps, layers, hooks and theme widgets, and enforce it with a zero-names test.
  - Look comes from a theme behind widgets; prove it with a plain test theme.
  - Pin exact commits; an upgrade is its own job.
  - A second small game is the real test.
- **Save hygiene.** Grep the save format before adding a field (a planned field name already held the timestamp). Give new state its own namespace, let old saves fall back field by field, and test with a save that lacks the new field.
- **Small gotchas:**
  - add settings rows at the end, or key-press tests break;
  - `page.evaluate(string)` calls the result if the last expression is a function, so end setup strings with `true;`;
  - serve with `charset=utf-8`;
  - wrap IndexedDB callbacks in try.
- **Placement and layout code:** score candidates; never take the first legal spot. Match the camera to the scene's scale before tuning anything else. Report which path produced the result (rules, authored, hand-placed or fallback).
- **Ask where a tool's output goes next before building the last step.** A "Save to repo" button was removed, because changes go through PRs and "Copy JSON" was enough.

## 8. Process for agent jobs

- **The repo is the single source of truth** for code and docs. The worst incident: a feature's code, test and docs existed only on a published page after another thread overwrote the docs. The test was lost for good.
- **One branch per job.** Merge main, rebuild, re-test and push before any hand-off. Never publish from uncommitted or unpushed code.
- **Small start-up docs:** the rules, a status file with one short row per job, and a history archive read only on demand. One runbook had grown to about 130k tokens read at every start.
- **Status rows:**
  - `DONE <date> (PR)`
  - `IN PROGRESS`
  - `WAITING ON <human>: exactly what`
  - `PARKED: why`

  Edit only your own row.
- **Record every approval** with the human's exact words and the date. Record when they waive a gate.
- **Do only the job asked;** upgrades and refactors are never a side effect of another job.
- **Never hand off without a playable review surface.**
  - Give the human a hub with jump buttons, restart, bookmarkable links and practice saves kept separate from real saves.
  - Build review pages from the same code as the game, never a copy.
  - Link editors from the page the human is on, and open them on a starting guess.
  - Let the human fix things by dragging on the real scene at real scale.
- **Every animation change ships with playback in the same commit:** play and pause, slow speed, frame stepping, the loop seam. Judge at native size beside the current art. A static contact sheet is never an animation hand-off.
- **Hand-offs to another agent** (e.g. an image agent): the prompt is fully self-contained. It includes:
  - clone and branch commands;
  - the docs to read, in order;
  - the exact assets and filenames;
  - the style rules and an attempt cap;
  - "never resize";
  - where the originals go;
  - push rules (rebase, never force);
  - a required reply: attempts per asset, hashes, test results, open concerns, and what is not claimed.

  Check the brief's facts against the code first. Parallel agents write only their own files and manifests, and one owner integrates.
- **Verify a hand-off by content hash, not by file date.** An "updated" track was byte-identical to the old one.
- **Spend rule:**
  - state the estimate before any paid run;
  - small single runs are fine once the job is approved;
  - batches above a threshold need a yes;
  - log the actual cost (tool estimates ran 1.8–2.7× the real bill);
  - test one cheap run before batching, and never re-call a generation to retry.
- **Keep raw art out of the game repo,** in an assets repo with a manifest row per file and pushes in modest batches.
- **Lessons logs:** one per area (engine and pipeline lessons go where every game inherits them; setting lessons stay with the game). Each entry is a rule plus the incident that taught it. Append before ending the job.
- **Before trusting an old note, check the code.** Open items are often already done.
- **Ambition with a practical path.** Big ideas are welcome when you can see a practical way to build each one. Keep experiments revertible so a rollback is one step.

## 9. Hand-off checklist

- [ ] The charter and rules were read, and the job stayed in scope.
- [ ] The engine side works with every new asset missing.
- [ ] The quick tests pass, plus the area's own test; the full suite passes before merge. Any failure is checked on clean main.
- [ ] Playable review link or page updated; animation playback added in the same commit.
- [ ] Cutscenes hand control back; codex text leaks nothing ahead of the hero.
- [ ] Player text meets the reading rules and boxes page at sentence ends.
- [ ] Asset originals archived with prompt and reference order, and hand-off changes verified by hash.
- [ ] Spend logged.
- [ ] Main merged in, rebuilt, re-tested, pushed.
- [ ] Status row updated (state, branch, exactly what the human must do); lessons appended.
