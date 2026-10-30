"""The sample game, Cincinnatus 458 BC (Ronin job fw-F6, 29 Oct 2026; the framework's sample-game/ since job fw-F5): built from
sample-game/ alone with the framework's own pages (tools/buildlib.py), played on the test clock.

Builds sample-game/pub_cincinnatus, then: no Ronin file, asset or scene in the page; the registries hold the game's content;
title -> New Journey -> the opening cards -> the farm; the hut and back; Cincinnatus at the plough; the envoys cutscene hands control back;
the stake wall (a tight wall, played with exact presses) feeds the breakout battle's line-up; the battle is won; the yoke; sixteen days later;
the end card; the Chronicle's three entries; a replay of the stake wall is score-only; a gappy wall and a lost fight never block the story.
"""
import json, os, re, sys
import testlib
import buildlib, gamepaths
from playwright.sync_api import sync_playwright

OUT = buildlib.build('cincinnatus')   # sample-game/pub_cincinnatus (whichever game's folder the test is run from)
PAGE = os.path.join(OUT, 'test.html')
html = open(PAGE, encoding='utf-8').read()
PORT = testlib.serve(OUT)
SHOTS = os.path.join(testlib.ROOT, 'shots'); os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(ok, label):
    print(('OK   ' if ok else 'FAIL ') + label, flush=True)
    if not ok: fails.append(label)

# ---- the page is the game's alone ----
ronin_ids = ['scene_town_well', 'hayato_22', 'room_tsuru_house', 'area_paddies', 'town_well']
assets = json.loads(re.search(r'const ASSET_SRC=(\{.*?\});', html).group(1))
scenes = json.loads(re.search(r'const SCENE_JSON=(\{.*?\});\n', html).group(1))
check(not any(k.startswith(('scene_town', 'room_tsuru', 'char_hayato', 'portrait_hayato')) for k in assets), 'no Ronin image in ASSET_SRC')
check(sorted(scenes) == ['area_farm', 'room_hut'], 'SCENE_JSON holds only the game\'s two scenes')
# the second line of five of Ronin's content files (src/ of the Ronin repo when the slice was built beside it; job fw-F5 keeps the
# markers here, as the framework no longer sits next to them): none may reach the page
RONIN_MARKERS = {'03_data.js': '//  RONIN — game data: items, techniques, enemies, music, wo', '04_maps.js': '//  RONIN — Chapter 1: Sekigahara-juku (autumn 1600)',
                 '05f_chapter1.js': '//  RONIN — Chapter 1, Sekigahara-juku, in the painted scene', '02d_chars.js': '//  RONIN — characters at native resolution: a paper-doll re',
                 '05t_ronin_scene.js': "//  RONIN — the game's own story steps and painted-scene lay"}
for f, marker in RONIN_MARKERS.items():
    check(marker not in html, f'Ronin content file {f} is not in the page')
check('const GAME={"id": "cincinnatus"' in html, 'GAME is sample-game/game.json')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = testlib.page(b)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:300]))
    pg.goto(f'http://localhost:{PORT}/test.html')
    ev = pg.evaluate
    def tap(key, settle=150):
        pg.keyboard.down(key); pg.wait_for_timeout(50); pg.keyboard.up(key); pg.wait_for_timeout(settle)
    def advance(until, limit=400, label=''):
        """press Z through dialogs and cards until `until` (a JS expression) holds"""
        for _ in range(limit):
            if ev(until): return True
            tap('KeyZ', 120)
        print('  stuck at', ev('[G.state, SC.id, Dialog.active && Dialog.who, Script.active, !!G.card, Script.queue.length]'), label)
        return False
    def shot(name): pg.locator('#screen').screenshot(path=os.path.join(SHOTS, f'cincinnatus_{name}.png'))

    check(ev("G.state === 'title' && GAME.id === 'cincinnatus' && SAVE_KEY === 'cincinnatus_save_v1'"), 'title up, the game\'s own save key')
    check(ev("contentGet('allies','cincinnatus').cast === 'cincinnatus_50' && content('chronicle').entries.length === 3 && !!MINI.stakewall && !!contentGet('story', 'area_farm') && !!contentGet('story', 'room_hut') && content('cast').length === 7 && contentGet('enemies', 'aequi_warrior').cast === 'aequi_40' && heroStats(newHero()).maxHp === 40"), 'content, minigame, story, cast and progression are registered')
    check(ev("menuPageList().map(p => p.id).join() === 'items,techniques,equip,status,party,chronicle,settings,save,close'"), 'the game chose its menu pages')
    shot('title')
    tap('KeyZ'); check(ev('Title.diff != null'), 'New Journey asks for difficulty')
    tap('KeyZ')
    check(advance("G.state === 'scene' && SC.id === 'area_farm' && !G.card && !Dialog.active && !Script.active", label='opening'), 'the opening cards lead to the farm')
    check(ev("SC.img === assetImg('area_farm') && !!ASSET_SRC.area_farm"), 'the farm plays on its own painting')
    shot('farm')
    # the hut and back (one room)
    ev("SC.hero.x = 1920 * SC.k; SC.hero.y = 745 * SC.k; SC.hero.dir = 1")
    for _ in range(30):
        if ev("SC.id === 'room_hut'"): break
        pg.keyboard.down('ArrowUp'); pg.wait_for_timeout(100); pg.keyboard.up('ArrowUp'); pg.wait_for_timeout(60)
    advance("SC.id === 'room_hut' && !G.fadeDir && !SC.warp", 60)
    check(ev("SC.id === 'room_hut' && SC.npcs.some(n => n.id === 'racilia')"), 'the door leads into the hut; Racilia is home')
    shot('hut')
    ev("const n = scNpc('racilia'); SC.hero.x = n.x; SC.hero.y = n.y + 20 * SC.k; SC.hero.dir = 1")
    tap('KeyZ'); check(ev("Dialog.active && Dialog.who === 'Racilia'"), 'Racilia talks')
    advance("!Dialog.active && !Script.active")
    ev("SC.hero.x = 836 * SC.k; SC.hero.y = 905 * SC.k; SC.hero.dir = 0")
    for _ in range(30):
        if ev("SC.id === 'area_farm'"): break
        pg.keyboard.down('ArrowDown'); pg.wait_for_timeout(100); pg.keyboard.up('ArrowDown'); pg.wait_for_timeout(60)
    advance("SC.id === 'area_farm' && !G.fadeDir && !SC.warp", 60)
    check(ev("SC.id === 'area_farm'"), 'out of the hut, back on the farm')
    # Cincinnatus at the plough
    ev("const n = scNpc('cin'); SC.hero.x = n.x - 22 * SC.k; SC.hero.y = n.y; SC.hero.dir = 3")
    tap('KeyZ'); check(ev("Dialog.active && Dialog.who === 'Cincinnatus'"), 'Cincinnatus talks at the plough')
    pg.wait_for_timeout(400); shot('dialog')
    advance("!Dialog.active && !Script.active")
    check(ev('G.f.cin_met === 1 && chronOn()'), 'meeting him opens the Chronicle')
    # the envoys at the plough
    ev("const n = scNpc('cin'); SC.hero.x = n.x - 22 * SC.k; SC.hero.y = n.y; SC.hero.dir = 3")
    tap('KeyZ')
    saw = {'cine': False, 'envoys': False, 'racilia': False}
    for _ in range(400):
        if ev("G.state === 'mini'"): break
        if ev("cineOn && cineOn()" if ev("typeof cineOn === 'function'") else "false"): saw['cine'] = True
        if ev("!!scNpc('envoy_b') && !scNpc('envoy_b').hidden"): saw['envoys'] = True
        if ev("!!scNpc('racilia') && !scNpc('racilia').hidden"): saw['racilia'] = True
        if ev("Dialog.active && Dialog.who === 'Elder Envoy' && /Hail/.test(Dialog.pages.join())"): shot('envoys')
        tap('KeyZ', 120)
    check(saw['envoys'] and saw['racilia'], 'the envoys come up from the landing; Racilia brings the toga')
    check(ev("G.f.cin_envoys === 1 && (G.inv.stakes || 0) === 1 && inParty('cincinnatus')"), 'the dictator joins; Titus carries twelve stakes')
    check(ev("G.state === 'mini' && MG.kind === 'stakewall'"), 'the night march leads to the stake wall')
    # the stake wall, played with exact presses (a tight wall)
    pg.wait_for_timeout(600); tap('KeyZ'); pg.wait_for_timeout(100)
    check(ev("MG.R.phase === 'play'"), 'the stake wall starts on A')
    ev("""window.testHook = () => { const R = MG && MG.R; if (!R || !R.playing) return; const t = rhythmTime(R);
          for (const n of R.notes) if (!n.res && !n.cue && !n.pushed && Math.abs(t - n.t) < 0.02) { n.pushed = 1; R.inq.push({ k: n.key, t: n.t }); } }""")
    for _ in range(80):
        if ev('!!(MG && MG.result)'): break
        pg.wait_for_timeout(500)
    ev('window.testHook = null')
    shot('stakewall')
    check(ev("MG.result.value.quality === 'tight' && MG.stakes === 12"), 'twelve stakes driven, a tight wall')
    advance("G.state === 'battle'", 80, 'to battle')
    check(ev("G.f.cin_wall === 'tight' && B.enemies.length === 2 && B.party.length === 2"), 'a tight wall: two Aequi get through; Titus and Cincinnatus fight')
    check(ev("B.opts.paint === 'bg_battle_algidus' && !!assetImg('bg_battle_algidus')"), 'the battle is on the Algidus backdrop')
    pg.wait_for_timeout(1500); ev('testRender()'); shot('battle')
    ev("endBattle('win')")
    check(advance("G.f.cin_home === 1 && SC.id === 'area_farm' && !G.fadeDir", 200, 'yoke'), 'after the battle: the yoke, then sixteen days later at the farm')
    check(ev("G.f.cin_yoke === 1 && !inParty('cincinnatus')"), 'the yoke recorded; the dictator has laid down the office')
    check(advance("G.f.cin_end === 1 && !G.card && !Script.active", 200, 'end'), 'back at the plough, the end card')
    shot('home')
    check(ev("chronEntries().filter(e => e.when(G.f)).length === 3"), 'three Chronicle entries are recorded')
    check(ev("chronEntries().every(e => e.text(G.f).length > 200)"), 'each entry has its text')
    # the Chronicle on the pause menu
    tap('KeyC'); pg.wait_for_timeout(200)
    check(ev("G.state === 'menu'"), 'the pause menu opens')
    tap('KeyX'); pg.wait_for_timeout(200)
    # replay: score only
    check(ev("G.state === 'scene'"), 'the menu closes back to the farm')
    before = ev("JSON.stringify([G.f.cin_wall, G.inv, G.hero.xp])")
    ev("const n = scNpc('cin'); SC.hero.x = n.x - 22 * SC.k; SC.hero.y = n.y; SC.hero.dir = 3")
    tap('KeyZ')
    for _ in range(20):
        if ev("G.state === 'mini' || (Dialog.active && !!Dialog.choices)"): break
        tap('KeyZ', 120)
    pg.wait_for_timeout(600); tap('KeyZ')
    check(ev("G.state === 'mini' && MG.opt.replay"), 'a replay of the stake wall from the farm')
    pg.wait_for_timeout(600)
    ev("MG.R.phase = 'play'; rhythmStart(MG.R)")
    for _ in range(60):
        if ev('!!(MG && MG.result)'): break
        pg.wait_for_timeout(500)
    check(ev("MG.result.value.quality === 'gappy' && G.f.cin_wall_best >= 0"), 'an idle replay is a gappy wall, best score kept')
    advance("G.state === 'scene' && !Script.active", 40)
    check(ev("JSON.stringify([G.f.cin_wall, G.inv, G.hero.xp])") == before, 'the replay changed nothing but the best score')
    # a gappy first wall and a lost fight never block (charter areas 5 and 6)
    check(ev("cinFoes('gappy').length === 3 && cinFoes('sound').length === 3 && cinFoes('tight').length === 2"), 'the wall decides how many Aequi get through')
    ev("G.f = { cin_met: 1, cin_envoys: 1, cin_wall: 'gappy' }; run(cinBreakout())")
    advance("G.state === 'battle'", 30)
    ev("G.hero.hp = 0; for (const p of B.party) p.m.hp = 0; startDefeat()")
    pg.wait_for_timeout(1500)
    check(ev("B.phase === 'lose'"), 'a lost breakout offers the defeat choice')
    tap('KeyZ', 300)   # Try again
    check(ev("G.state === 'battle' && B.phase !== 'lose' && B.enemies.length === 3"), 'Try again restarts the same fight')
    # review jumps (90_jumps.js; the animation review page links them)
    ev("battleRetry && (G.state = 'scene')")
    ev("cinJump('envoys')"); check(advance("G.state === 'mini'", 300, 'jump envoys'), 'jump envoys: the cutscene plays through to the stake wall')
    ev("miniFinish && MG && (MG.result = { value: { quality: 'sound' } }) && miniFinish()")
    check(ev("G.state === 'battle' || Script.active || !!G.card"), 'the jump carries on into the breakout')
    for j, cond in [('stakewall', "G.state === 'mini' && MG.kind === 'stakewall'"), ('breakout', "G.f.cin_wall === 'sound'"), ('home', "SC.id === 'area_farm' && G.f.cin_home === 1")]:
        ev(f"cinJump('{j}')"); pg.wait_for_timeout(300)
        check(ev(cond), f'jump {j}')
    jp = b.new_page(); jerr = []; jp.on('pageerror', lambda e: jerr.append(str(e)))
    jp.goto(f'http://localhost:{PORT}/test.html?jump=home'); jp.wait_for_function("window.TEST_READY && G.f && G.f.cin_home === 1 && SC.id === 'area_farm'", timeout=20000)
    check(not jerr, 'the ?jump=home URL opens sixteen days later on the real clock'); jp.close()
    # the framework's test jumps and the game's generated test page (job fw-F7; core/01a_game.js section 9, tools/buildlib.py write_test_page)
    ids = ev("testJumpList().map(j => j.id)")
    check(len(ids) >= 9 and ids[0] == 'farm' and {'farm', 'hut', 'plough', 'envoys', 'home', 'stakewall', 'breakout', 'breakout_tight', 'breakout_gappy', 'practice', 'chronicle'} <= set(ids), f'{len(ids)} test jumps registered, in order')
    groups = ev("testJumpList().map(j => j.group)"); runs = [g for i, g in enumerate(groups) if i == 0 or groups[i - 1] != g]
    check(len(runs) == len(set(runs)), 'each group of jumps sits together (no group split by the order)')
    check(ev("testJump('no_such_jump')") is False and ev("TEST_JUMPS['constructor']") is None, 'an unknown jump id starts nothing (and the registry has no inherited keys)')
    for jid in ids:
        before = len(errs); ev(f"testJump('{jid}')"); pg.wait_for_timeout(400)
        check(ev(f"window.TEST_JUMP === '{jid}' && ['scene', 'mini', 'battle'].includes(G.state)") and len(errs) == before, f'test jump {jid} starts cleanly ({ev("G.state")})')
    check(ev("testJump('hut'), G.f.cin_met === 1 && SC.id === 'room_hut' && G.inv.bread === 2 && !Dialog.active && !Script.active"), 'a jump starts a clean journey: its flags, its bread, the hut, no dialog or script')
    check(os.path.isfile(os.path.join(OUT, 'tests.html')) and os.path.isfile(os.path.join(OUT, 'tests_fragment.html')), 'the build wrote the test page (tests.html and the fragment the site wraps)')
    tp = testlib.page(b); terr = []; tp.on('pageerror', lambda e: terr.append(str(e)))
    tp.goto(f'http://localhost:{PORT}/tests.html')
    tp.wait_for_function('window.CINCINNATUS_TEST_READY === true', timeout=20000)
    check(tp.locator('#jumps button[data-j]').count() == len(ids) and tp.locator('#jumps .jump-group').count() == len(runs), 'the test page shows a button per jump, grouped')
    check(tp.evaluate("SAVE_KEY === 'cincinnatus_review_jumps' && G.state === 'title'") and tp.locator('#test-status').inner_text().startswith('Choose a moment'), 'the test page has its own practice save and waits at the title')
    with tp.expect_navigation(): tp.locator('#jumps button[data-j="hut"]').click()
    tp.wait_for_function('window.CINCINNATUS_TEST_READY === true && window.TEST_JUMP === "hut"', timeout=20000)
    check(tp.evaluate("SC.id === 'room_hut'") and tp.locator('#test-status').inner_text().startswith('Testing: Inside the hut'), 'a button reloads at ?jump=hut and starts in the hut')
    check(tp.locator('#jumps button[data-j="hut"]').get_attribute('aria-pressed') == 'true' and tp.locator('#jumps button[aria-pressed="true"]').count() == 1, 'the chosen jump is the one marked')
    check(tp.evaluate("localStorage.getItem('cincinnatus_save_v1')") is None, 'the test page leaves the real save slot alone')
    check(not terr, 'no errors on the test page' + ('' if not terr else ': ' + terr[0])); tp.close()
    # save and continue keep the game's own namespace
    ev("G.state = 'scene'; enterScene('area_farm'); writeSave(saveData())")
    check(ev("localStorage.getItem('cincinnatus_save_v1') !== null && localStorage.getItem('ronin_save_v1') === null"), 'the save goes to the game\'s own key, not Ronin\'s')
    check(ev("STANDIN.made.length === 0"), 'the whole playthrough used the game\'s own art, no stand-in' + ('' if ev("STANDIN.made.length === 0") else ': ' + ev("STANDIN.made.join()")))
    # the engine's marked stand-ins (src/01e_standin.js) fill in for art that has not landed: strip a sheet, a portrait and a painting from the page
    sp = testlib.page(b); serr = []; sp.on('pageerror', lambda e: serr.append(str(e)[:200]))
    def strip(route):
        r = route.fetch(); body = r.text()
        for k in ('char_envoy_a', 'portrait_cincinnatus_50', 'room_hut'):
            body = re.sub(r'"%s": "[^"]*", ?' % k, '', body)
        route.fulfill(response=r, body=body)
    sp.route('**/test.html', strip); sp.goto(f'http://localhost:{PORT}/test.html'); sp.wait_for_function('window.TEST_READY', timeout=20000)
    check(sp.evaluate("!ASSET_SRC.char_envoy_a && !ASSET_SRC.room_hut && !!ASSET_SRC.area_farm"), 'the stripped page really lacks those three files')
    check(sp.evaluate("charSprite({ cast: 'envoy_a' }, 0, 0).width === 84 && portrait({ cast: 'cincinnatus_50' }).width > 0 && !!assetImg('room_hut')"), 'a missing sheet, portrait and painting are replaced by stand-ins')
    check(sp.evaluate("['char_envoy_a', 'portrait_cincinnatus_50', 'room_hut'].every(n => STANDIN.made.includes(n)) && !STANDIN.made.includes('area_farm') && !STANDIN.made.includes('char_titus_17')"), 'only the missing art is a stand-in, and each is listed')
    sp.evaluate("G.state = 'scene'; enterScene('room_hut')"); sp.wait_for_timeout(300)
    check(sp.evaluate("SC.id === 'room_hut'") and not serr, 'a scene whose painting is a stand-in still opens' + ('' if not serr else ': ' + serr[0])); sp.close()
    real = [e for e in errs if 'prebake' not in e]
    check(not real, 'no page errors' + ('' if not real else ': ' + ' | '.join(real[:5])))
    b.close()
print('ALL OK' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails))
sys.exit(1 if fails else 0)
