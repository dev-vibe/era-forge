# Screenshots of the staged scenes (Ronin job 13; framework tool since job fw-F7, 30 Oct 2026).
# Usage: npx eraforge run cine_shots [--game <id>] <scene>      (a game's repo: also `python3 tools/cine_shots.py <scene>` through its entry)
# Starts New Journey on the game's build with a TEST_START hook that sets flags and enters the scene, then presses Z through each script,
# saving a frame each time something new shows (dialog page, keepsake, insert, echo) to shots/cine/<scene>_NN.png. Between scripts it walks
# the hero to the next spot (the plan) and presses Z or walks into an exit.
# The scenes are the game's: cine_shots.json in its config folder (see gamepaths):
#   { "set": js run before every start, "starts": { scene: js | { "script": js, "set": false } }, "plan": { scene: [[x, y] | ["exit", x, y], ...] } }
# `set` is put in front of each start script (a start object with "set": false runs its script alone); the plan is what to do after each
# script ends: [x, y] walks there and presses Z, ["exit", x, y] walks into an exit. No scene given = the first one in the file.
# `final` (optional): a js expression for extra fields of the state main() returns beside the flags, camera bars and items (the game's own).
import sys, os, glob, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'testkit'))
import gamepaths
import testlib
from playwright.sync_api import sync_playwright
GAME = gamepaths.pop_game(sys.argv)
PUB = gamepaths.pub_dir(GAME)   # inside the game's folder (the sample game's is in the framework)
_cfg = json.load(open(gamepaths.config(GAME, 'cine_shots.json'), encoding='utf-8'))
SET = _cfg.get('set', '')
STARTS = {k: (SET + v if isinstance(v, str) else (SET if v.get('set', True) else '') + v['script']) for k, v in _cfg['starts'].items()}
PLAN = {k: [tuple(s) if s and isinstance(s[0], str) else s for s in v] for k, v in _cfg.get('plan', {}).items()}
FINAL = _cfg.get('final', '{}')   # js expression: extra fields of the final state main() hands back (a game's own, e.g. a staged prop's phase)
WHICH = sys.argv[1] if len(sys.argv) > 1 else next(iter(STARTS))
if WHICH not in STARTS: raise SystemExit(f'cine_shots --game {GAME}: no scene {WHICH!r} in cine_shots.json (has: {", ".join(STARTS)})')
ST = "(()=>({st:G.state,item:typeof ItemFX==='object'&&!!ItemFX.active, dlg:Dialog.active, who:Dialog.who, ch:!!Dialog.choices, txt:Dialog.active?Dialog.pages[Dialog.page].join(' '):'', scr:Script.active, card:!!G.card, id:SC.id, keep:!!CINE.keep, ins:!!CINE.ins, echo:!!CINE.echo, bar:CINE.bar, warp:!!SC.warp, fade:G.fadeDir, x:SC.hero?Math.round(SC.hero.x/SC.k):0, y:SC.hero?Math.round(SC.hero.y/SC.k):0, tgt:(G.state==='scene'&&!Dialog.active&&!Script.active)?(t=>t?(t.npc?'npc:'+t.npc.id:'thing'):null)(sceneTarget()):null}))()"
def main(WHICH=WHICH, SHOTS=True):
    if SHOTS:
        for f in glob.glob(f'shots/cine/{WHICH}_*.png'): os.remove(f)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = testlib.page(b); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        PORT = testlib.serve(PUB)
        pg.add_init_script("window.TEST_START = () => { %s };" % STARTS[WHICH])
        pg.goto(f'http://localhost:{PORT}/index.html')
        n = [0]
        # job tests-4: the loops run in the page (CS below, one round trip per call), frame for frame and key for key as the Python loops
        # they replaced; play() hands back to Python only where a screenshot is taken, then carries on from that exact point.
        pg.evaluate("""(ST) => { window.CS = (() => {
          const T = __T, ok = T.pyTruthy, seen = new Set(), s = new Function('return ' + ST);
          const F = {
            s,
            async tap(key = 'KeyZ', ms = 50) { await T.down(key); await T.wait(ms); await T.up(key); await T.wait(30); },
            async play(limit, i0, resume, st, SHOTS) {
              if (st == null) st = s();
              for (let i = i0; i < limit; i++) {
                if (resume !== 'A' && resume !== 'B') {
                  st = s();
                  const key = JSON.stringify([st.txt, st.keep, st.ins, st.echo, st.card, st.id]);
                  if (!seen.has(key) && (ok(st.dlg) || ok(st.keep) || ok(st.ins) || ok(st.echo))) {
                    seen.add(key); await T.wait(SHOTS ? (ok(st.dlg) ? 1000 : 1600) : 200);
                    return { shot: ok(st.keep) ? 'k' : ok(st.ins) ? 'i' : ok(st.echo) ? 'e' : 'd', i, resume: 'A', st };
                  }
                }
                if (resume === 'B') { resume = null; await F.tap(); await T.wait(300); continue; }
                resume = null;
                if (ok(st.item)) { await T.wait(1800); await F.tap(); continue; }
                if (ok(st.card)) return { shot: 'card', i, resume: 'B', st };
                if (ok(st.dlg) || ok(st.keep)) { await F.tap(); await T.wait(150); continue; }
                if (st.st === 'scene' && !ok(st.scr) && !ok(st.warp) && !ok(st.fade)) return { st };
                await T.wait(150);
              }
              return { st };
            },
            async walk(tx, ty, limit = 300) {
              for (let i = 0; i < limit; i++) {
                const st = s();
                if (st.st !== 'scene' || ok(st.dlg) || ok(st.scr) || ok(st.warp) || ok(st.fade)) return st;
                const dx = tx - st.x, dy = ty - st.y;
                if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return st;
                await F.tap(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'), 120);
              }
              return s();
            },
            async face() { for (let i = 0; i < 6; i++) { if (ok(s().tgt)) break; await F.tap('ArrowUp', 60); } },
          };
          return F;
        })(); }""", ST)
        def tap(key='KeyZ', ms=50): pg.js('([k, ms]) => CS.tap(k, ms)', [key, ms])
        def shot(tag):
            n[0] += 1
            if SHOTS: pg.locator('#screen').screenshot(path=f'shots/cine/{WHICH}_{n[0]:02d}_{tag}.png')
        def s(): return pg.evaluate(ST)
        def play(limit=1500):
            r = pg.js('([l, sh]) => CS.play(l, 0, null, null, sh)', [limit, SHOTS])
            while 'shot' in r:
                shot(r['shot'])
                r = pg.js('([l, i, rs, st, sh]) => CS.play(l, i, rs, st, sh)', [limit, r['i'], r['resume'], r['st'], SHOTS])
            return r['st']
        def walk(tx, ty, limit=300): return pg.js('([x, y, n]) => CS.walk(x, y, n)', [tx, ty, limit])
        pg.js("async () => { await CS.tap(); await __T.wait(300); await CS.tap(); await __T.wait(600); }")   # title: New Journey, difficulty
        st = play()
        for step in PLAN.get(WHICH, []):
            if isinstance(step, tuple): pg.js("async ([x, y]) => { await CS.walk(x, y); await CS.tap('ArrowDown', 300); }", [step[1], step[2]])
            else:
                pg.js("async ([x, y]) => { await CS.walk(x, y); await CS.face(); }", list(step))
                shot('before'); tap()
            st = play()
        shot('end')
        pg.wait_for_timeout(800)   # the bars ease out after the script ends
        fin = pg.evaluate("Object.assign({f: G.f, bar: CINE.bar, cur: !!CINE.cur, mem: CINE.mem, zoom: ST.zoom, inv: G.inv}, " + FINAL + ")")
        print('stopped at', {k_: st[k_] for k_ in ('st', 'id', 'x', 'y')}, 'shots', n[0], 'errors:', errs[:5])
        b.close()
        return st, fin, errs
if __name__ == '__main__':
    main()
