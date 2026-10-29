# Job fw-F6: painterly gouache slice art

29 October 2026. Built-in image creation only; no API or other spend. The approved
`area_farm.png` was attached to every generation, including every reroll and mask
edit. Style B and the prompts in `art-prompts.md` were used, with targeted layout,
stride and silhouette corrections. The farm was neither regenerated nor reprocessed.

All 16 selected originals were copied unchanged to `/tmp/art/<name>.png`, then to
ronin-assets `outputs/cincinnatus/`; source and archived SHA-256 hashes match.
Raw commit: `3890c043f71003a4dcc3f023752a19f2ebe45721` on ronin-assets main.
Its README has one path/byte-size/description/job/hash row per file. Total new
originals: 27,840,098 bytes; largest new original: 3,062,144 bytes. Plain git, no LFS.
Masks remain ignored raw files for Claude to trace, not runtime game assets.

## Attempts

29 generations total. Each row records total attempts and the selected attempt;
no image exceeded three attempts.

| Original (.png) | Attempts | Selected |
| --- | ---: | ---: |
| ground_area_farm | 3 | 2 |
| room_hut | 1 | 1 |
| ground_room_hut | 3 | 3 |
| bg_battle_algidus | 1 | 1 |
| char_titus_17 | 3 | 3 |
| char_cincinnatus_50 | 3 | 3 |
| char_racilia_45 | 2 | 2 |
| char_envoy_a | 2 | 2 |
| char_envoy_b | 1 | 1 |
| char_aequi_30 | 3 | 3 |
| char_aequi_40 | 2 | 2 |
| pose_titus_17 | 1 | 1 |
| pose_cincinnatus_50 | 1 | 1 |
| portrait_titus_17 | 1 | 1 |
| portrait_cincinnatus_50 | 1 | 1 |
| ins_toga | 1 | 1 |

## Remaining defects and visual review

- **ground_area_farm:** best mask keeps grass and field open and the objects
  recognisable, but the shoreline follows some bush tops and allows white into
  river areas. Thin white rims remain around parts of the roof and foliage.
  Not strictly binary: 942,914 of 1,573,352 RGB pixels are neither exact black nor
  exact white (much of the apparent white is off-white). Same 1672 x 941 canvas.
  Attempts 1/3 overblocked low vegetation; attempt 3 also left white sky.
- **ground_room_hut:** walls/hearth are more usable in attempt 3, but white
  hanging herbs/basket, parts of the loom frame and fine object outlines remain.
  Not strictly binary: 690,505 of 1,573,352 pixels are neither exact black nor
  exact white. Same 1672 x 941 canvas. Attempt 1 left the daub wall white and
  hollowed the hearth; attempt 2 made some furniture white.
  Both masks FAIL the exact two-colour requirement and need review while tracing;
  they were not thresholded, painted or repaired with code.
- **All seven char_* sheets:** correct nine-cell grid, required facing rows,
  separated complete figures and clean magenta fields, but front/profile camera
  is lower than the scene's requested 45 degrees in several sheets. Walking
  phase quality varies: Titus repeats the front/back leg phase; Cincinnatus
  repeats the back phase; the younger Aequian repeats the front phase. Profile
  strides across the cast are too similar in leg phase, even where arms differ.
  Racilia's shawl and the younger envoy's toga switch sides in a corrected stride.
  The elder envoy and older Aequian have clearer front/back leg alternation.
  The older Aequian also retains extra shin wrappings. These are best attempts,
  not a claim that all walks meet animation acceptance.
- **pose_titus_17 and pose_cincinnatus_50:** six distinct left-facing poses,
  separated and unclipped. DOWN is collapsed on a knee/hand, not fully prone.
  Titus's READY spear is diagonal; WIND-UP is overhand. Review weapon continuity
  across those holds; no painted effects or shadows.
- **room_hut:** matches the palette/materials and required objects, but some side-wall
  perspective remains. In the current scene, Racilia stands over a doorway post;
  geometry/occlusion was left for Claude's retrace as instructed.
- At game size: painterly colour masses remain readable, fine brush detail is
  lost, and nearest-neighbour rendering/hard-alpha atlas edges look stepped,
  particularly limbs and spear shafts. Sprites are not broadly blurred; no broad
  magenta halo is visible, although isolated pink/bright weapon-edge pixels remain.
  Both portraits have real alpha (0–255), read well at dialogue size and show no
  conspicuous fringe on washi. The battle backdrop and toga insert are satisfactory.

## Processing and wiring

`python games/cincinnatus/tools/make_art.py /tmp/art` processed 16 inputs, producing
14 runtime images plus two raw masks. The sole missing input was `area_farm`,
intentionally omitted: its approved existing WebP stayed byte-identical.
No original was resized, cropped, sharpened, recoloured or painted.

Only wiring/fit changes accompany the art:

- `make_char.py` accepts opt-in `fit`; `make_art.py` passes it, uniformly fitting
  the whole sheet within existing cells so spear tips do not clip. Legacy calls
  keep their previous scale. No drawing, new outline or art correction is added.
- Hero battle pose lookup uses `GAME.hero.cast`, with the existing Hayato fallback
  for Ronin's config. This makes Titus's supplied pose atlas actually appear.
- Animation category builder accepts a validated repository-local `assetRoot`.
  The Cincinnatus category now has 21 directional walking loops, two six-pose
  inspections and two attack sequences; every delivered atlas cell is covered.
  Generated playback: `shots/animations/cincinnatus/index.html`;
  site route after the normal site build: `/test/animations/cincinnatus/`.
  Normal/quarter speed, pause, stepping, scrub and loop seams are available.

No scene JSON, walk polygon, door, thing, story content or raw anchor changed.
Nothing was merged to main or deployed.

## Verification and next step

- Cincinnatus build and `tests/cincinnatus_test.py`: **ALL OK**, full story,
  hut/return, envoys/insert, minigame, battle/retry, replay, Chronicle and save.
- Quick suite plus `animation_review_test.py`: **22/22 passed**.
- Final targeted rerun after preserving Ronin's legacy hero fallback:
  `party_battle_test.py` and `cincinnatus_test.py`: **2/2 passed**.
- Separate playback inspection: all 25 clips contain changing artwork; checked
  normal/quarter-speed playback, scrubbed every frame, confirmed Titus's pose.
- Inspected title, farm, hut, dialog, envoys, stakewall, battle and home shots.
  The title screenshot captures the painting before its menu fade; title suite passes.
- Windows checks used installed Chrome, UTF-8 and the existing local Python
  dependencies. The Windows `python3` alias was unavailable, so `python` ran the
  exact repository entry points.

Claude: fetch the branch and raw repo, review the flagged art and re-trace the
ground masks against their paintings before changing scene geometry. Ash:
play the slice and decide whether the noted gait/camera/down-pose flaws are
acceptable for this framework experiment. Charter approval remains separate.
