# Theme screenshots (Ronin job fw-F4, 29 Oct 2026; framework tool since job fw-F7, 30 Oct 2026): every screen of the game, one PNG each, on the test clock.
#   npx eraforge run theme_shots [--game <id>] shoot <out_dir> [page]     page = test.html (the game's own theme, default) or theme_plain.html (the test theme)
#   npx eraforge run theme_shots [--game <id>] compare <dir_a> <dir_b>    pixel compare two shoots; exit 1 if any screen differs
# Each screen boots a fresh page (Math.random is seeded by testlib, so a screen is the same every run) and is set up by script, so
# the before/after shoots of a refactor can be compared pixel for pixel. The screens are the game's own list, theme_shots.json in its config folder
# (see gamepaths): { "pre": js run once on the booted title (defines the helpers the setups use),
#                    "screens": [[name, setup js, frames to step after it], ...],
#                    "preload": js expression for the web-font pieces the screens' text needs (optional; default: the game's name and seal) }.
# The setup runs on a freshly booted title screen. The game's theme test renders the same list with the plain test theme (its tests/theme_test.py
# through game_screens()). Add a screen to the list when the game gains one.
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'testkit'))
import gamepaths

def load(game):
    return json.load(open(gamepaths.config(game, 'theme_shots.json'), encoding='utf-8'))


def game_screens(game=None):
    """(pre js, screens) of a game, from its theme_shots.json."""
    cfg = load(game or gamepaths.DEFAULT)
    return cfg['pre'], [tuple(s) for s in cfg['screens']]


def preload(cfg):
    """The js that waits for the web-font pieces the screens' text uses: the game's own expression, else its name and seal in every face."""
    if cfg.get('preload'): return cfg['preload']
    return ("Promise.all([['500', FONT], ['700', FONT], ['400', FONT], ['700', FONT_HEAD], ['800', FONT_HEAD], ['500', FONT_HEAD]]"
            ".map(([w, f]) => document.fonts.load(w + ' 30px ' + f, GAME.name + ' ' + (GAME.seal || []).join('')))).then(() => document.fonts.ready).then(() => true)")


def shoot(out, page='test.html', only=None, game=gamepaths.DEFAULT):
    import testlib
    from playwright.sync_api import sync_playwright
    cfg = load(game); pre, screens = cfg['pre'], [tuple(s) for s in cfg['screens']]
    os.makedirs(out, exist_ok=True)
    port = testlib.serve(gamepaths.pub_dir(game), cache=True)
    errs_all = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, js, steps in screens:
            if only and name not in only: continue
            pg = testlib.page(b, viewport={'width': 1300, 'height': 760}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'http://localhost:{port}/{page}')
            pg.evaluate(preload(cfg))
            pg.evaluate(pre)
            try:
                pg.evaluate('() => {' + js + '}')
                if steps: pg.step(steps)
                pg.locator('#screen').screenshot(path=os.path.join(out, name + '.png'))
            except Exception as e:
                errs.append('setup: ' + str(e).split('\n')[0])
            if errs: errs_all[name] = errs
            pg.close()
        b.close()
    for k, v in errs_all.items(): print('ERR', k, v[:3])
    print(f'{len(screens) if not only else len(only)} screens -> {out}, {len(errs_all)} with errors')
    return errs_all

def compare(a, b):
    from PIL import Image, ImageChops
    names = sorted(f for f in os.listdir(a) if f.endswith('.png'))
    bad = []
    for n in names:
        pb = os.path.join(b, n)
        if not os.path.exists(pb): bad.append((n, 'missing')); continue
        ia, ib = Image.open(os.path.join(a, n)).convert('RGBA'), Image.open(pb).convert('RGBA')
        if ia.size != ib.size: bad.append((n, 'size')); continue
        d = ImageChops.difference(ia, ib)
        if d.getbbox():
            px = sum(1 for v in d.convert('L').getdata() if v)
            bad.append((n, f'{px} px differ in {d.getbbox()}'))
    for n, m in bad: print('DIFF', n, m)
    print(f'{len(names)} screens compared, {len(bad)} differ')
    return bad

if __name__ == '__main__':
    game = gamepaths.pop_game(sys.argv)
    os.chdir(gamepaths.GAME_ROOT)
    if sys.argv[1] == 'shoot':
        e = shoot(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith('-') else 'test.html', [a for a in sys.argv[4:]] or None, game)
    else:
        sys.exit(1 if compare(sys.argv[2], sys.argv[3]) else 0)
