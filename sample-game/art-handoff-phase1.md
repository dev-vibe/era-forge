# Job fw-F6: style samples (phase 1)

29 October 2026. Awaiting Ash's choice of A or B. Generated with the built-in image creation tool only; no paid API or ElevenLabs calls. Three fresh generations per sample (initial attempt plus two rerolls), no reference images and no edits of earlier outputs. Nothing was resized, cropped, sharpened, recoloured, pixelated, re-encoded or otherwise post-processed. Only the selected originals were copied, byte for byte, to the art repository.

## Originals and archive

Repository: `dev-vibe/ronin-assets`, branch `main`, pushed commit **`987269d4b67064fe5e2ccaddec66e960f8aef39d`**. Its README manifest has one new row per PNG.

| Original path in ronin-assets | Kept | Native dimensions | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `outputs/cincinnatus/style_samples/sample_farm_A.png` | Attempt 3 of 3 | 1672 x 941 | 3516977 | `c50b68fb12e47f15c7038747b3d9b6e439903185cc2710f9b26621269c5b30f2` |
| `outputs/cincinnatus/style_samples/sample_farm_B.png` | Attempt 3 of 3 | 1672 x 941 | 3259882 | `e9cf58db4c2182713beaf7128b5f9017419d74c90e0c1b8a2db659eff0596321` |

Requested 16:9 landscape at the largest app size. The tool exposes no separate size control and returned 1672 x 941 for both selected originals (approximately 16:9, not exact). Those native dimensions were preserved. Source and archive-copy SHA-256 hashes match. Each file is below 100 MB; ordinary Git, no LFS.

## Style A: fresco-tinted pixel art

| Attempt | Review and disposition |
| --- | --- |
| 1 | Main scene elements present, but the camera was too low, sky/horizon prominent, ground very busy, and distant Rome included a stone arch bridge and grand pale classical buildings. Rejected. |
| 2 | Removed the bridge and reduced the settlement; frontal hut, clearer path and more usable ground. Still overly fine texture, the plough intruded into the worked field, and the distant bank retained landscape perspective. Superseded by 3. |
| 3 | **Kept.** Stronger crisp pixel clusters, simpler soil/foliage masses, a readable unploughed strip with the ard at its right edge, frontal thatched hut, boundary stone, barley/ditch, fig/jar and corner olives. Best overall style/layout match of the three. |

Still off: the image is not rigorously orthographic; the farm path narrows slightly toward the ferry and the far bank reads as a receding landscape. The landing is almost centred rather than clearly left of centre. The city has many tiled roofs and a generic columned temple whose specifically Etruscan timber construction cannot be established visually. The palette is mostly ochre/olive/umber, with Pompeian red mostly confined to roofs, and the pixel clusters/outlines are not a mechanically uniform 2-4-pixel grid/1-pixel outline. Grass remains busier than the requested calm ground. The jar is beside the fig but not wholly in deep shade. Treat this as a style candidate, not an approved final gameplay plate.

## Style B: painterly gouache

| Attempt | Review and disposition |
| --- | --- |
| 1 | Layout broadly present, but low scenic camera, visible sky, monumental walled Rome and a large pale classical temple; ground detail too uniformly fine for the soft gouache brief. Rejected. |
| 2 | Improved high framing, modest settlement and broad painted earth; hut front and period materials clearer. Path still tapered/curved, foliage remained detailed, and the style was too close to A at a glance. Superseded by 3. |
| 3 | **Kept.** Softer brushwork and colour transitions than A, broader soil strokes, clear field-side ard, horizontal river, frontal timber/daub/thatch hut, rightward path branch, boundary stone, fig/jar, barley/ditch and foreground olives. Strongest painterly candidate of the three. |

Still off: distant Rome and the landing retain some perspective; the path tapers and bends slightly instead of being a perfectly straight orthographic strip. The landing is near the centre, not distinctly left of centre. The temple still reads as generic columned classical architecture, so Claude should check it against the intended Etruscan appearance before any final plate. Some foliage and thatch remain fine and sharp rather than uniformly soft gouache. The fig/jar arrangement is readable but the jar is not fully shaded. The painting suggests a larger farm rather than communicating four iugera at a verifiable scale. Treat this as a style candidate, not an approved final gameplay plate.

## Shared visual review

- Both originals were inspected against prompt 0 and the Rules for every image: no visible people, animals, text, signatures, borders, SPQR, coins, eagle standards, armour or marble villas. Neither selected image includes a bridge.
- Both retain the top-to-bottom city/river/farm arrangement, left field and barley boundary, central landing-to-bottom route with a hut branch, right-hand thatched hut and trees, boundary stone and clay jar, and open ground for sprites.
- Warm daylight and shadows generally read from upper left to lower right. No character is painted in, so character/doorway scale cannot be verified from these samples alone. The sky was removed from the selected framing, but the distant city is still a scenic vista rather than the same strict overhead camera as the farm.
- These are visual observations, not a new archaeological reconstruction or a historian's sign-off. The repeated temple/camera shortcomings above are the main review points.

## Prompt provenance

Base: `games/cincinnatus/art-prompts.md` at game commit `2979bea3e67ce3b9c77fdbfeed5f97621d71bd80`, prompt 0, with the entire respective Style A or Style B block pasted verbatim in place of STYLE. The full prompt 0 scene body was preserved in every call. Canvas/global constraints were also restated as follows:

```text
Canvas: 16:9 landscape, the largest size the app offers, filled edge to edge. Rules for every image: Early Roman Republic, 458 BC: no coins, no lettering or SPQR, no eagle standards, no Imperial armour, no marble villas; farm buildings of wattle, daub, timber and thatch. No people painted into scenes, rooms or backdrops. No text, no signatures, no borders. High three-quarter top-down orthographic camera, about 45 degrees; fronts face the camera straight on; roofs about half a building's height; vertical lines stay vertical; no perspective vanishing, not isometric. A person is about 1.4 floor tiles tall; a doorway about 1.15 times a person. Late morning sun from the upper left, soft cast shadows to the lower right. Original output only, no post-processing.
```

Attempts 1 used that base without extra emphasis. Attempts 2 added instructions to remove sky/landscape camera and grand masonry/bridge architecture, keep the hut frontal, and strengthen the respective pixel or gouache treatment. The exact extra emphasis for the two selected attempts follows; it supplements the base, rather than replacing the source prompt.

**A, attempt 3:**

```text
Prioritize the named style faithfully: deliberately authored pixel-art clusters, visible small square 2-4-image-pixel pseudo-pixels, thin coloured outlines, flat restrained palette, simple large readable forms, restrained dither. Simplify grass and foliage into calm masses rather than thousands of realistic details. No photo-like or painterly microtexture. This is a 45-degree downward-looking orthographic game map with straight parallel path edges and no sky or visible horizon. River and near/far banks are horizontal. Farm hut front is exactly parallel to image plane with no visible side wall and thatched roof half its height. Distant city is only tiny thatched huts and tile-roof buildings on a rocky rise at the very top, one small timber Etruscan-style temple with red terracotta roof; no marble colonnade, monumental masonry, stone arches, aqueduct, stone bridge or later Imperial monuments. Simple wooden ard plough sits on the narrow UNPLOUGHED right-hand strip of the field, not in its middle. Preserve all requested paths, plants and props; no extra subjects.
```

**B, attempt 3:**

```text
Final emphasis: match a hand-painted gouache film background with visibly BROAD soft brushwork, large simple paint masses, lost-and-found soft edges and gentle colour transitions. Foreground grass is calm broad washes with sparse accents, tree crowns are broad painterly foliage shapes, soil furrows broad strokes; avoid uniform fine stippling or pixel-like sharp detail. The whole scene is a high 45-degree downward-looking orthographic game-map view, no sky/horizon; equal object scale across farm, no vanishing point. Main beaten path is straight vertically from the landing down to bottom, approximately uniform width, with a distinct branch right to hut. Front of hut faces camera squarely, no visible side wall. Plough rests on the narrow unploughed strip along field's right edge. Distant Rome is very small at the top: a rocky hill, modest thatched and tiled huts and hearth smoke, one small timber Etruscan temple with terracotta roof. No grand marble architecture, monumental masonry walls, aqueducts or stone bridges. Preserve the exact requested composition, fig, olives and jar. No outlines, no pixel grid, no dither.
```

## Scope and next step

Only this new handoff document is changed in the game repository, on `job/fw-f6-cincinnatus`. No phase 2 images, processing, wiring, style-anchor/charter decision, source changes or game-asset changes. No merge to main or force push. Verification: visual review, PNG header/size checks, source/copy hash comparison and Git scope/whitespace checks.

Runtime validation (existing stand-in game; the samples are intentionally not wired): `python build.py` passed with `PYTHONUTF8=1`. The restricted browser-test attempt produced no results and was interrupted; the local-browser run of `python run_tests.py quick -j 4` passed 20/21, including `cincinnatus_test.py`. Its real-time smoke test timed out at a 404 because the fresh clone lacked the generated `pub_ch1/road.html`. Ran the existing `python tools/make_road_page.py`, then reran only `python run_tests.py realtime_smoke_test.py -j 1`: 1/1 passed in 21 seconds. Thus all 21 quick checks passed across the initial completed run and the targeted rerun. Used existing local Playwright dependencies and installed Chrome; no dependencies, source files or game assets were changed. Generated build/test pages and logs are ignored local files, outside the committed change.

Ash chooses **A or B**; Claude then records the approved style anchor and charter wording. Phase 2 waits for that choice and its own brief. Neither style is selected by this handoff.
