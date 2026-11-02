# Themes

A theme is a game's look: the colours, fonts, panels, marks, pages, bands and battle effects every screen is drawn with (Ronin job fw-F4,
29 Oct 2026; in the framework since job fw-F5). `game.json` names one (`"theme": "ink-washi"`); the
engine and the game's content never draw that look themselves, they ask the theme.

| Theme | What it is |
| --- | --- |
| `ink-washi/` (in the Ronin repo, `themes/ink-washi/`) | Ronin's look, "ink on washi" (Job 8a, Ash's choice): cream washi panels with a dry-brush sumi frame, the vermilion seal, Zen Maru Gothic and Shippori Mincho, the ink battle effects of Jobs 11z and 11z-polish, the title's washi wash. |
| `plain/` | The test theme. Flat grey panels, a blue square, system fonts, one flat shape for every battle effect. Not a look for a game: a game's theme test (Ronin: `tests/theme_test.py`) builds the game with it and renders every screen, which proves nothing outside the game's theme still draws the game's look. The sample game builds on it. It is also the smallest complete theme to copy. |

## What a theme holds

- **`theme.json`, the tokens.** `colors` (the engine reads them as `UI.<name>`: `ink`, `soft`, `faint`, `seal` (the accent), `sealHi`,
  `sealDk`, `ochre`, `indigo`, `plum`, `cream`, `paper`, `outline`; every theme has the same names), `fonts` (`body` and `head` CSS stacks,
  `links` = the stylesheets the page loads, `preload` = `[font, sample text]` pairs the boot waits for), `sizes` (`dialog`; since 0.3.0 also `dialogLine` = the dialogue's line pitch, `subtitle` = subtitles under the letterbox, `help` =
  the menu's help line, `command` = the battle commands, each optional with the old size as default). The build injects
  it as `THEME_DEF` and puts the font links where `core/shell.html` says `<!--THEME_FONTS-->`. A game's own theme lives in its repo's
  `themes/<id>/`; the framework's (`plain`) are in this folder; both are found by id.
- **`*.js`, the code.** The build puts these files right after the core (`core/01*.js`), so only a game that uses the theme has its helpers.
  They register one drawer per widget with `defineThemeUI(name, fn)` and per battle effect with `defineThemeFx(type, fn, { raw })`, plus
  `THEME_FX.default` for any effect type without a drawer. The widgets and their arguments are listed in `THEME_WIDGETS`
  (`core/01a_game.js`, section 8): panel, selBar, text, mark, bubble, banner, gauge, stroke, page, stamp, liberation, cutIn, techTag,
  titleLockup, artWash, enso, battleBackdrop, battleImpact, battleSil, battleWipe, standoffWind, loading, scrollRails, scrollRods,
  rhythmNote, rhythmRing (the minigame kit's rhythm lane: a falling note and the closing timing ring, job fw-F5a), keyCap and emphasis
  (marked text: the box behind a key's name and the one highlight's colour and weight, Ronin job text-pass, 0.3.0).
  A theme must register every one (the test checks both themes).
- **`art/`, the images.** Loaded as `theme_<file name>` and read with `themeArt(name)` (Ronin: `title_washi_backing.png`, the generated kozo
  paper behind the title lockup, made by Ronin's `tools/make_title_art.py`; plain: `mark.png`). A game theme's art is made like any other art
  (Ronin's charter area 13: the image model or Ash in the app) and its originals go to the game's assets repo like the rest. The plain theme's 16 px
  `mark.png` (a blue square) is a test fixture drawn with a few lines of PIL, not art.

## Drawing through the theme

Engine and content code draw with the core's wrappers in `core/01_core.js` (and two in `core/05_field.js` / `systems/05_bonds.js`): `win` (a panel),
`selBar`, `txt` (the theme picks the colour of text on a panel), `headTxt`, `uiMark`, `cursor`, `moreMark`, `uiBubble`, `uiBanner`, `gauge`,
`uiStroke`, `uiPage`, `uiStamp`, `uiArtWash`, `frontMenu`; `drawCutIn`, `drawTechTag` and the battle's effect loop (`drawBattleFx`,
`drawSignatureFx` in `kits/battle-turn/07d_battle_fx.js`) ask the theme too. Colours come from `UI.*`, never a literal of the theme's palette.

**Marked text** (0.3.0): every string the player reads may carry `[[words]]` (the game's one highlight: names of people, places and story
items, drawn in the theme's `emphasis` colour and weight) and `{a}` `{b}` `{start}` `{up}` `{down}` `{left}` `{right}` (a key cap with that key's
name in the player's control scheme, drawn on the theme's `keyCap`); `{move}` and `{moveKeys}` are the movement keys' names as words.
`txt`, `txtW` and `wrap` read it; `headTxt` shows it plain. The dialogue box pages at sentence ends (`pageText` in `core/05_field.js`).

Which effects a battle moment starts, where and in what colour (the recipes in `07d_battle_fx.js`) stay with the battle kit; the theme
only draws them.

## Checking a change

Ronin's checks, the model for a game's own (in the Ronin repo):
- `python3 tests/theme_test.py`: tokens, registry, every screen with the plain theme (shots in `shots/theme_plain/`), every battle effect.
- `python3 tools/theme_shots.py shoot <dir>` before and after a change, then `python3 tools/theme_shots.py compare <before> <after>`: every
  screen pixel for pixel (`SCREENS` there is the list of every screen; add a screen when the game gains one). `tests/battle_fx_test.py`
  writes every battle effect moment to `shots/fx/` for the same comparison.
