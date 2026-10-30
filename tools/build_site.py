"""Build the game's hosted site, site/ (`npx eraforge site`): the game, its test and review pages, the test hub, the animation test sheets
and the other games it hosts. No raw art or API access needed. (Ronin's hosting job, Codex, 23 Oct 2026; framework since job fw-F5.)

Everything game-specific comes from the game:
  game.json        id and name: the review save slots (<id>_review_<page>), the navigation and hub titles
  catalogue.json   (eraforge.json `config` folder) the test pages: { "prebuild": [generators], "extraPages": [{source, dest, review}],
                   "tests": [{slug, title, note, source, generator?, alias?, kind?, scene?}], "siteHooks": "<module>.py" }
                   A generator is a script in the game's tools/ run as `<generator> --hosted`; `source` is the built folder the page is
                   copied from. kind "scenes" adds the scene browser's jump buttons; any other kind is the game's site hook.
  site hooks       (optional) a module in the config folder: `kinds = {kind: fn(fragment, entry) -> fragment}` for its own page kinds and
                   `extra(out, document) -> [routes]` for pages built another way (Ronin: the item moments and the title review)
  tools/site/      the site's own files (test-tools.css, test-tools.js, saves.html as /saves/): the game's own copy in its folder if it has one, else the
                   framework's (tools/site/ here), whose slots are filled from game.json (site_values)
  eraforge.json    `host`: other games served at /games/<id>/ beside this one, each built with its own pages and save key
  test jumps       a game whose src/*.js registers test jumps (defineTestJump, core/01a_game.js section 9) gets a generated test page, one button per
                   jump: /games/<id>/test/ for a hosted game, /test/jumps/ for the site's own game (job fw-F7); a game with none gets no such page
"""
from pathlib import Path
import datetime
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from html import escape

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamepaths
import buildlib as fw
from make_animation_category_review import generate as build_animation_reviews

FW = Path(gamepaths.FW)
GID = gamepaths.DEFAULT
ROOT = Path(gamepaths.game_dir(GID))
OUT = ROOT / 'site'
NAME = gamepaths.game_json(GID).get('name') or GID


def catalogue(gid):
    with open(gamepaths.config(gid, 'catalogue.json'), encoding='utf-8') as f: return json.load(f)


CAT = catalogue(GID)
TESTS = [(t['slug'], t['title'], t['note'], t['source'], t.get('generator')) for t in CAT['tests']]


def site_hooks():
    name = CAT.get('siteHooks')
    if not name: return None
    path = Path(gamepaths.config(GID, name))
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec); sys.path.insert(0, str(path.parent)); spec.loader.exec_module(mod)
    return mod


HOOKS = site_hooks()

# Other games hosted beside this one, at /games/<id>/, each with its own images (/games/<id>/img/) and its own save key (its game.json
# saveKey). A hosted game shows a card on the hub; it has no test pages of its own here.
GAMES = [(gid, cat['title'], cat['note']) for gid in gamepaths.games() if gid != GID
         and os.path.isfile(gamepaths.config(gid, 'catalogue.json')) for cat in [catalogue(gid)]]
for _gid, *_ in GAMES:
    if catalogue(_gid).get('tests'): raise SystemExit(f'build_site: the hosted game {_gid} lists test pages; only the main game\'s catalogue hosts test pages so far')


def test_pages():
    """The hosted games that have a generated test page (built by game_site)."""
    return [g[0] for g in GAMES if (OUT/'games'/g[0]/'test'/'index.html').is_file()]


def run(*args):
    subprocess.run(args, cwd=ROOT, env=gamepaths.tool_env(GID), check=True)


def link(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    try: os.link(source, target)
    except OSError: shutil.copy2(source, target)


def document(fragment, review=None, category=None):
    # All tools share one set of assets. Review saves never replace the player's real save slot.
    fragment = fragment.replace('"img/', '"/img/').replace('"audio/', '"/audio/')
    if review:
        fragment = fragment.replace('<script>', '<script>window.GAME_SAVE_KEY='+json.dumps(GID+'_review_'+review)+';', 1)
    split = fragment.index('<div class="frame">')
    head, body = fragment[:split], fragment[split:]
    nav = f'<nav class="host-nav" aria-label="{escape(NAME)} pages"><a href="/">Play</a> · <a href="/test/">Test pages</a> · <a href="/saves/" target="_blank" rel="noopener">Saved games</a></nav>'
    style = '<link rel="stylesheet" href="/test-tools.css">'
    if review == 'road': style += '<style>body{--reserve:235px}body.touch{--reserve:350px}</style>'
    tools = ''
    if category:
        options = ''.join(f'<option value="{slug}"'+(' selected' if slug == category else '')+f'>{escape(title)}</option>' for slug,title,*_ in TESTS)
        tools = '<div class="test-tools"><label>Test page <select id="test-category">'+options+'</select></label> <button class="chip" id="test-restart">Restart this test</button><p id="test-status" role="status">Loading test…</p></div><script src="/test-tools.js"></script>'
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+head+style+'</head><body>'+body+tools+nav+'</body></html>'


def test_hub():
    games = ''.join(f'<a class="test-card game-card" href="/games/{gid}/"><h2>{escape(title)}</h2><p>{escape(note)}</p><span>Play →</span></a>'
                    + (f'<a class="test-card game-card" href="/games/{gid}/test/"><h2>{escape(title)} · test page</h2><p>One button per test jump: start straight at any scene, cutscene, minigame or fight. Its own practice save.</p><span>Open test page →</span></a>' if gid in test_pages() else '')
                    for gid,title,note in GAMES)
    games = '<h2>Other games</h2><p>Built on the same engine from their own folders; each keeps its own save.</p><div class="test-grid">'+games+'</div>' if games else ''
    jumps = f'<a class="test-card" href="/test/jumps/"><h2>{escape(NAME)} · test jumps</h2><p>One button per registered test jump: start straight at any scene, cutscene, minigame or fight.</p><span>Open test →</span></a>' if (OUT/'test/jumps/index.html').is_file() else ''
    cards = jumps + ''.join(f'<a class="test-card" href="/test/{slug}/"><h2>{escape(title)}</h2><p>{escape(note)}</p><span>Open test →</span></a>' for slug,title,note,*_ in TESTS)
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(NAME)+' · Test pages</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/test-tools.css"></head><body class="test-hub"><main><a href="/">← Back to the game</a><p class="eyebrow">'+escape(NAME.upper())+' · DEVELOPMENT</p><h1>Test pages</h1><p>Choose a test, then use the buttons below the game to jump to a moment. Each page has its own practice save; your main journey stays safe.</p><p><a href="/test/animations/">Animation test sheets — playable motion by category</a></p><div class="test-grid">'+cards+'</div>'+games+'</main></body></html>'


def game_site(gid):
    # a hosted game's page and its own img/ and audio/ under /games/<id>/ (relative paths, so no rewriting)
    run(sys.executable, str(FW/'tools'/'build.py'), '--game', gid)
    src, dest = Path(gamepaths.pub_dir(gid)), OUT/'games'/gid
    for folder in ('img', 'audio'):
        for source in (src/folder).iterdir(): link(source, dest/folder/source.name)
    fragment = (src/'index.html').read_text(encoding='utf-8')
    split = fragment.index('<div class="frame">')
    nav = f'<nav class="host-nav" aria-label="Pages"><a href="/">Play {escape(NAME)}</a> · <a href="/test/">Test pages</a></nav>'
    dest.mkdir(parents=True, exist_ok=True)
    (dest/'index.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        + fragment[:split] + '<link rel="stylesheet" href="/test-tools.css"></head><body>' + fragment[split:] + nav + '</body></html>', encoding='utf-8')
    if (src/'tests_fragment.html').is_file():   # job fw-F7: the game registers test jumps; its test page is at /games/<id>/test/ (relative paths one folder up)
        test = (src/'tests_fragment.html').read_text(encoding='utf-8').replace('"img/', '"../img/').replace('"audio/', '"../audio/')
        cut = test.index('<div class="frame">')
        tnav = f'<nav class="host-nav" aria-label="Pages"><a href="/games/{gid}/">Play</a> · <a href="/games/{gid}/test/">Test page</a> · <a href="/test/">All test pages</a> · <a href="/">{escape(NAME)}</a></nav>'
        (dest/'test').mkdir(exist_ok=True)
        (dest/'test'/'index.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            + test[:cut] + '<link rel="stylesheet" href="/test-tools.css"></head><body>' + test[cut:] + tnav + '</body></html>', encoding='utf-8')


def scene_browser(fragment, scene):
    # Use the full game asset set and the same scenario lifecycle as the other tools.
    script = '''<script>
    const jumps = document.createElement('div'); jumps.id = 'jumps'; jumps.className = 'jumps';
    for (const [id, scene] of Object.entries(SCENE_JSON)) {
      const button = document.createElement('button'); button.dataset.j = id;
      button.textContent = scene.name || id.replace(/_/g, ' '); jumps.append(button);
    }
    document.querySelector('.frame').after(jumps);
    jumps.addEventListener('click', e => {
      const id = e.target.dataset.j; if (!SCENE_JSON[id]) return;
      G.f = %s;
      G.hero = newHero(); G.inv = %s; G.allies = {}; G.active = [];
      enterScene(id); document.getElementById('screen').focus();
    });
    </script>''' % (json.dumps(scene['flags']), json.dumps(scene['inv']))
    title = re.search(r'<title>.*?</title>', fragment).group(0)   # the game page's own title (the first)
    return fragment.replace(title, f'<title>{NAME} Scene Browser</title>', 1) + script


def site_values():
    """What the framework's site files (tools/site/) say about this game, all from game.json: the slots in their text. A game can name some of
    them in game.json `site` (a build-only key: no page ships it; buildlib.site_names lists them with their defaults)."""
    g = gamepaths.game_json(GID); names = fw.site_names(g)
    return {'__GAME__': NAME, '__GAMEID__': g.get('id') or GID, '__HERO__': (g.get('hero') or {}).get('name', 'The hero'),
            '__CURRENCY__': ((g.get('currency') or {}).get('label') or 'coin').lower(), '__SAVE_KEY__': names['saveKey'],
            '__BACKUP_KEY__': names['saveBackupKey'], '__TEST_READY__': names['testReady'], '__CONTROLS_KEY__': names['controlsKey']}


def site_file(name):
    """A file of the site's own as bytes: the game's (tools/site/<name> in its folder, copied as it is), else the framework's, with the
    game's names in its slots (site_values). None when neither exists."""
    own = ROOT/'tools'/'site'/name
    if own.is_file(): return own.read_bytes()
    base = FW/'tools'/'site'/name
    if not base.is_file(): return None
    text = base.read_bytes().decode('utf-8')
    for slot, value in site_values().items(): text = text.replace(slot, value)
    assert not re.search(r'__[A-Z]+__', text), f'a slot is left in {name}'
    return text.encode('utf-8')


def main():
    # Refuse to clean an existing directory unless this builder owns it.
    assert OUT.resolve() == ROOT / 'site'
    marker = OUT / f'.{GID}-build'
    if OUT.exists():
        if not marker.is_file(): raise RuntimeError(f'site/ exists without the {NAME} build marker; refusing to replace it')
        shutil.rmtree(OUT)
    OUT.mkdir()
    marker.write_text('Generated by build_site.py\n', encoding='utf-8')
    run(sys.executable, str(FW/'tools'/'build.py'), '--linked')
    for generator in CAT.get('prebuild', []): run(sys.executable, 'tools/'+generator)
    for *_, generator in TESTS:
        if generator: run(sys.executable, 'tools/'+generator, '--hosted')   # the generators live in the game's tools/
    pub = gamepaths.pub(GID)
    for folder in ('img', 'audio'):
        for source in (ROOT/pub/folder).iterdir(): link(source, OUT/folder/source.name)
    pages = [(pub, '', None, None)] + [(p['source'], p['dest'], p.get('review'), None) for p in CAT.get('extraPages', [])]
    kinds = {}
    for t in CAT['tests']:
        slug, key = t['slug'], t.get('alias', t['slug'])
        kinds[slug] = t
        pages.append((t['source'], 'test/'+slug, key, slug))
        if 'alias' in t: pages.append((t['source'], 'review/'+key, key, slug))
    for source, dest, review, category in pages:
        target=OUT/dest/'index.html'; target.parent.mkdir(parents=True, exist_ok=True)
        fragment = (ROOT/source/'index.html').read_text(encoding='utf-8')
        kind = kinds[category].get('kind') if category else None
        if kind == 'scenes': fragment = scene_browser(fragment, kinds[category]['scene'])
        elif kind:
            if not (HOOKS and kind in getattr(HOOKS, 'kinds', {})): raise SystemExit(f'build_site: test page kind {kind!r} needs the game\'s site hook (catalogue.json siteHooks)')
            fragment = HOOKS.kinds[kind](fragment, kinds[category])
        target.write_text(document(fragment, review, category), encoding='utf-8')
    jump_page = ROOT/pub/'tests_fragment.html'   # job fw-F7: the site's own game registers test jumps and its builder wrote the page
    if jump_page.is_file():
        (OUT/'test/jumps').mkdir(parents=True, exist_ok=True)
        (OUT/'test/jumps/index.html').write_text(document(jump_page.read_text(encoding='utf-8').replace('id="test-play" href="../"', 'id="test-play" href="/"')), encoding='utf-8')
    for gid, *_ in GAMES: game_site(gid)
    (OUT/'test/index.html').write_text(test_hub(), encoding='utf-8')
    animation_catalog = build_animation_reviews(OUT/'test/animations')
    extra = HOOKS.extra(OUT, document) if HOOKS and hasattr(HOOKS, 'extra') else []
    for name in ('test-tools.css', 'test-tools.js'):
        if site_file(name): (OUT/name).write_bytes(site_file(name))
    if site_file('saves.html'):
        (OUT/'saves').mkdir()
        (OUT/'saves/index.html').write_bytes(site_file('saves.html'))
    try:
        commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip()
    except (OSError, subprocess.CalledProcessError): commit=branch='unknown'
    info={'commit':os.getenv('VERCEL_GIT_COMMIT_SHA',commit), 'branch':os.getenv('VERCEL_GIT_COMMIT_REF',branch),
          'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'framework':framework_version(),
          'pages':['/','/test/']+extra+['/'+p['dest']+'/' for p in CAT.get('extraPages', [])]+['/test/'+t[0]+'/' for t in TESTS]+['/review/'+key+'/' for key in [t['alias'] for t in CAT['tests'] if 'alias' in t]]+(['/saves/'] if site_file('saves.html') else [])+['/test/animations/']+['/test/animations/'+slug+'/' for slug in animation_catalog['categories']]+(['/test/animations/inserts/'] if (OUT/'test/animations/inserts').is_dir() else [])+(['/test/jumps/'] if (OUT/'test/jumps/index.html').is_file() else [])+[p for g in GAMES for p in (['/games/'+g[0]+'/'] + (['/games/'+g[0]+'/test/'] if g[0] in test_pages() else []))]}
    (OUT/'build.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    (OUT/'robots.txt').write_text('User-agent: *\nDisallow: /test/\nDisallow: /review/\nDisallow: /saves/\nDisallow: /games/\n',encoding='utf-8')
    print('Static hosting build:',OUT,info['commit'],flush=True)


def framework_version():
    """The framework the site was built with: its package.json version, and the commit when it is a git checkout (FW_PATH)."""
    v = json.loads((FW/'package.json').read_text(encoding='utf-8')).get('version')
    try: c = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=FW, text=True, stderr=subprocess.DEVNULL).strip() if (FW/'.git').exists() else None
    except (OSError, subprocess.CalledProcessError): c = None
    return {'version': v, 'path': 'FW_PATH' if os.environ.get('FW_PATH') else 'package', **({'commit': c} if c else {})}


if __name__ == '__main__': main()
