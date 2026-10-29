# Cincinnatus slice: art prompts (job fw-F6, 29 Oct 2026)

The ChatGPT app makes every image (charter area 9). The slice already plays on marked STAND-IN art drawn by the engine (`src/01e_standin.js`, game.json `standIn`); each file below replaces its stand-in by name the moment it is in `games/cincinnatus/assets/game/` (wired by `python3 tools/wire_art.py --game cincinnatus /tmp/art`). Hand-off flow: `claude/ronin-art-handoff.md` (the agent prompts are at the end of this file).

**Style: painterly gouache (Style B below), decided by Ash on 29 Oct 2026** after the two samples (`art-handoff-phase1.md`): "lets go with painterly gouache since it's looking interesting!". **Sample B is the style anchor and is already the farm painting:** `sample_farm_B.png` (ronin-assets `outputs/cincinnatus/style_samples/`, copied unchanged as `outputs/cincinnatus/area_farm.png`) is wired as `area_farm.webp`. Image 1 is done; attach that file to every remaining prompt.

## Rules for every image

- Early Roman Republic, 458 BC (charter area 3): no coins, no lettering or "SPQR", no eagle standards, no Imperial armour (no segmented plate, no Imperial helmets), no marble villas; farm buildings of wattle, daub, timber and thatch; soldiers in the hoplite manner (round shields, spears, bronze helmets of the period). The Aequi are an Italic hill people: spears, round or oval shields, bronze disc breastplates; drawn with dignity, never as savages. Shields carry at most plain geometric bands.
- **No people painted into scenes, rooms or backdrops** (characters are sprites). No text, no signatures, no borders.
- Camera for scenes and rooms: high three-quarter top-down orthographic, about 45°; fronts face the camera straight on; roofs about half a building's height; vertical lines stay vertical; no perspective vanishing, not isometric. A person is about 1.4 floor tiles tall; a doorway about 1.15 times a person.
- Light: late morning, sun from the upper left, soft cast shadows to the lower right (the battle backdrop is at night).
- Deliver every image exactly as generated: never resize, crop, sharpen, recolour or "pixel-fix" it in the app or in code. The scripts only key, crop and fit.

## The style block (paste Style B where a prompt says STYLE)

**Style A, fresco-tinted pixel art (not chosen; kept for the record):** "Fine, crisp pixel art with small square pseudo-pixels (2 to 4 image pixels each) and 1-pixel coloured outlines. The palette is drawn from Roman wall painting: Pompeian red, yellow ochre, terracotta, olive green, raw umber, lamp black and chalk white, with a muted green-blue for river water. Flat colour areas with restrained dithered shading; calm, slightly desaturated ground, with saturated colour saved for a few focal points. Graceful, readable shapes; fewer, bigger masses with open ground between them."

**Style B, painterly gouache (the game's style):** "A soft, painterly digital illustration in the manner of a gouache background painting for an animated film: confident visible brush strokes, soft edges, gentle colour transitions, luminous warm Mediterranean light. The palette of a dry Latium spring: ochre grass, olive and dusty green, terracotta, warm umber earth, chalk white, a muted green-blue river. Calm ground, saturated colour saved for a few focal points. Not pixel art: no pixel grid, no hard outlines."

## Prompt 0: the farm across the Tiber (the text of image 1, `area_farm.png`)

Canvas: 16:9 landscape, the largest size the app offers, filled edge to edge.

> STYLE. A key scene for a historical adventure game set in 458 BC: the small farm of Lucius Quinctius Cincinnatus, four iugera of meadow on the west bank of the Tiber, opposite Rome, on a late spring morning. High three-quarter top-down orthographic camera (about 45 degrees), fronts facing the camera, roofs about half a building's height, vertical lines vertical, no perspective. Composition, top to bottom: along the very top, the far bank and the early city of Rome seen small in the distance (a rocky hill with an Etruscan-style temple with a terracotta roof, clustered thatched and tiled roofs, hearth smoke); below it the Tiber running left to right across the whole width, brown-green with spring rain; on the near bank, slightly left of centre, a small timber ferry landing jutting into the water. A beaten earth path runs from the landing straight down through the farm to the bottom edge, with a branch going right to the hut. Left of centre, a large ploughed field of dark brown furrows, with a narrow unploughed strip on its right edge where a simple wooden ard plough rests at the end of a furrow. At the far left edge, beyond a narrow boundary ditch, a neighbour's field of ripening barley. Upper right, the family's single-room hut of wattle and daub with a steep thatched roof and a dark doorway facing the camera. A rough boundary stone near the path between field and hut; a fig tree and an olive tree with a clay water jar in the fig's shade at the right; a few olive trees near the bottom corners. Late morning sun from the upper left, soft shadows to the lower right. Plenty of open, walkable ground. No people, no animals, no text, no borders. Deliver the image exactly as generated: do not resize, downscale, pixelate or post-process it.

## The slice's art (Style B; attach the anchor `area_farm.png` to every prompt)

Save each original as `/tmp/art/<name>.png`. Sheets on a perfectly flat magenta (#FF00FF) background; portraits on a transparent background.

| # | File | What |
| --- | --- | --- |
| 1 | `area_farm.png` | DONE: sample B, wired 29 Oct 2026 (the style anchor). Do not regenerate |
| 2 | `ground_area_farm.png` | The farm's walkable ground: an EDIT of `area_farm.png`, same canvas: pure white where a person could stand and walk (paths, grass, the field, the landing), pure black everywhere else (the river, the hut's walls and roof, tree trunks and crowns, the boundary stone, the water jar, the ditch) |
| 3 | `room_hut.png` | Inside the hut (below) |
| 4 | `ground_room_hut.png` | The hut's walkable floor, the same kind of edit as 2 |
| 5 | `bg_battle_algidus.png` | Battle backdrop, night at Mount Algidus (below) |
| 6-12 | `char_titus_17.png`, `char_cincinnatus_50.png`, `char_racilia_45.png`, `char_envoy_a.png`, `char_envoy_b.png`, `char_aequi_30.png`, `char_aequi_40.png` | Walking sheets (below) |
| 13-14 | `pose_titus_17.png`, `pose_cincinnatus_50.png` | Battle pose sheets (below) |
| 15-16 | `portrait_titus_17.png`, `portrait_cincinnatus_50.png` | Portraits (below) |
| 17 | `ins_toga.png` | The close-up insert: the toga (below) |

**3. room_hut.** "STYLE. The inside of a poor Roman farmer's single-room hut, 458 BC, as one game screen (16:9), same high three-quarter top-down orthographic camera. Walls of wattle and daub between rough timber posts, the back wall across the top third; a beaten-earth floor filling the rest. In the middle of the floor a low stone hearth with a banked fire and a clay pot; at the left a warp-weighted loom against the wall with a half-woven undyed blanket and clay loom weights; at the right a plain cedar chest; a few clay jars, a hanging basket and dried herbs; a doorway in the bottom edge, centre, opening to daylight. Warm light from the door and the hearth. No people, no text."

**5. bg_battle_algidus.** "STYLE. A battle backdrop, 16:9: night on the slopes of Mount Algidus in 458 BC. A dark wooded ridge against a starry sky across the top third; across the middle, a freshly dug ditch and a long new palisade of sharpened wooden stakes running left to right, with a few campfires glowing behind it; the whole lower half is open trampled earth and grass where the fighters will stand, lit by firelight from the left and cool moonlight. No people, no text."

**6-12. Walking sheets.** "STYLE, as a character sprite sheet: one character drawn 9 times in a 3 x 3 grid on a perfectly flat magenta (#FF00FF) background, full body, the same size in every cell, nothing touching between cells, no shadows on the ground, no text. Keep the brushwork inside each figure: every silhouette has a clean, defined edge against the magenta, with no soft halo or painted texture spilling onto the background. Row 1: facing the camera (front); row 2: back to the camera; row 3: facing LEFT in profile. Column 1: standing still; columns 2 and 3: the two strides of a walk (left foot forward, right foot forward). High three-quarter view to match the scenes." Then the character:
- `char_titus_17`: "Titus, 17, a lean plebeian farm youth: short dark curly hair, beardless, sun-browned; a knee-length undyed wool tunic belted with a cord, bare legs, simple leather sandals; no weapon."
- `char_cincinnatus_50`: "Lucius Quinctius Cincinnatus, a farmer in his late fifties: short grey hair and a short grey beard, weathered face, broad strong hands; a plain grey-brown wool work tunic, knee-length, belted, sandals, forearms dusty from the field."
- `char_racilia_45`: "Racilia, his wife, about 45: dark hair pinned up, a long ankle-length belted wool dress in a madder red and a plain shawl over her shoulders."
- `char_envoy_a`: "An envoy of the Roman Senate, about 40: short dark hair, clean-shaven, a full white wool toga draped over a tunic, sandals."
- `char_envoy_b`: "An elder envoy of the Roman Senate, about 65: grey hair and a grey beard, a full white wool toga over a tunic, sandals."
- `char_aequi_30`: "An Aequian warrior, about 30, of an Italic hill people: short tunic, a round bronze disc breastplate on leather straps, a bronze cap helmet, a round wooden shield with a plain painted band, a spear; bare legs, sandals."
- `char_aequi_40`: "An older Aequian warrior, about 40, bearded: short tunic, a bronze disc breastplate, a bronze helmet with cheek pieces, a tall oval wooden shield with a plain rim, a short sword at his hip and a spear."

**13-14. Battle pose sheets.** "STYLE, as a battle pose sheet: one character drawn 6 times in a 3 x 2 grid on a perfectly flat magenta (#FF00FF) background, full body, every figure facing LEFT, the same size throughout, nothing touching between figures, no ground shadow, no effects, no text. Every silhouette has a clean, defined edge against the magenta (no soft halo). Top row: READY (weapon raised, balanced), WIND-UP (drawing back to strike), CUT (the thrust or blow at full extension). Bottom row: HURT (recoiling from a blow), GUARD (shield up, braced), DOWN (fallen to one knee, then to the ground)."
- `pose_titus_17`: Titus as in his walking sheet but issued a soldier's kit: a round wooden shield rimmed in bronze on his left arm and a long thrusting spear (hasta).
- `pose_cincinnatus_50`: Cincinnatus as dictator in the field: a plain bronze cuirass over his tunic, a bronze helmet with a horsehair crest, a short sword; no shield.

**15-16. Portraits.** "STYLE, as a dialogue portrait: head and shoulders, three-quarter view facing slightly right, a calm expression, on a transparent background, square." Titus and Cincinnatus as described above (Cincinnatus in his work tunic). Charter area 3 allows real people close up.

**17. ins_toga.** "STYLE, as a cinematic close-up, 16:9, filled edge to edge: a weathered older man's forearms and hands, dusty from the field, wiping the sweat away with the edge of a grey work tunic, while a woman's hands hold out a folded white wool toga to him from the right. Bright late-morning light, a soft out-of-focus background of ploughed earth. No faces, no text, no borders."

---

## Agent prompt (paste into the ChatGPT app)

```text
You are working on the Ronin game repo, on its second-game slice "Cincinnatus, 458 BC" (job fw-F6). Everything you need is in the repo; you cannot see my chat with Claude. The style is decided: painterly gouache, "Style B" in games/cincinnatus/art-prompts.md.

1. Clone https://github.com/dev-vibe/Ronin, `git fetch origin job/fw-f6-cincinnatus`, `git checkout job/fw-f6-cincinnatus`. Work ONLY on that branch; never merge to main, never force-push. Read CLAUDE.md, claude/ronin-art-handoff.md, games/cincinnatus/charter.md (areas 3 and 9) and games/cincinnatus/art-prompts.md in full.

2. Image 1 (area_farm) is DONE: it is dev-vibe/ronin-assets outputs/cincinnatus/area_farm.png (the approved style sample B). Do not regenerate it; attach it as the style reference to every image you make. Generate the other 16 images in the table of games/cincinnatus/art-prompts.md, with the prompt text below the table, pasting the Style B block where a prompt says STYLE. Make ground_area_farm.png first, as an EDIT of area_farm.png (same canvas, pure white walkable ground, pure black everything else), then room_hut and its ground mask, then the rest. Built-in image creation only, no spend. Check each result against its prompt and the "Rules for every image" (camera, grid and facing for sheets, nothing touching, flat magenta with clean silhouette edges, transparent portraits, period details, no people in scenes, no text); re-roll at most 3 times per image and keep the best. NEVER resize, crop, sharpen, recolour or "pixel-fix" an image; do not hand-draw or edit art with code.

3. Save each original unchanged as /tmp/art/<name>.png (not area_farm.png), then from the repo root run `python3 tools/wire_art.py --game cincinnatus /tmp/art` (it keys, crops and fits; it skips anything missing and says so).

4. Run `python3 build.py --game cincinnatus` and `python3 tests/cincinnatus_test.py`; look at shots/cincinnatus_*.png (title, farm, hut, dialog, envoys, stake wall, battle, home). Fix only wiring problems and say so. Do NOT change walk polygons, doors or things in the .scene.json files: Claude re-traces them from your ground masks.

5. Commit the processed files in games/cincinnatus/assets/game/ (never the originals) with the message "Job fw-F6: slice art (painterly gouache)" and `git push origin job/fw-f6-cincinnatus` (if refused: fetch, rebase, push; never force).

6. Push the ORIGINALS (your 16, including the two ground masks) to dev-vibe/ronin-assets under outputs/cincinnatus/, one README.md manifest row per file (path, size, what it is, job fw-F6), commit and push (plain git, no LFS, no file over 100 MB, never force).

7. Reply with: what you generated and the attempts per image, both commit hashes, the test result, how the painterly sprites look at game size (soft? haloed?), and every image you are not happy with and why.
```
