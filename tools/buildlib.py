"""The build's helpers and the framework's own pages for a game (`npx eraforge build` runs tools/build.py, which uses this module;
a game's own page builder imports it too: `import buildlib as fw`). Eraforge, job fw-F5, 29 Oct 2026.

The code of a game's page:
  const GAME = game.json (minus the build-only keys) ; const THEME_DEF = the theme's theme.json
  + the engine files whose names start with 01 (core/) + the theme's *.js + every other engine file and the game's own src/*.js,
    all in file-name order (the engine's files: core/, systems/ and kits/<kit>/ for each kit game.json names; see gamepaths.engine_files)
The page: the shell (core/shell.html) with the game's name in its <!--GAME_NAME--> slots and the theme's font links in <!--THEME_FONTS-->,
then one script: AUDIO_SRC, ASSET_SRC (images, linked), ASSET_META, SCENE_JSON (assets/game/*.scene.json) and the code.

A game with its own page builder names it in eraforge.json `build` (Ronin: its test and review pages); tools/build.py runs that script in
the game's folder with the same arguments, and it imports the helpers below (`import buildlib as fw`). Any other game gets the framework's pages:
  pub_<id>/index.html   the fragment the site builder wraps        pub_<id>/test.html   a full document for Playwright
  pub_<id>/img/, audio/ the game's images and audio (hard links), and the theme's art as img/theme_<name>.<ext>
"""
import glob, json, os, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamepaths

FW = gamepaths.FW
MIME = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg'}
AUDIO = {'.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'}
HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
# game.json keys that are production notes for the tools, never read by the game at run time: not shipped in the page's GAME
BUILD_ONLY_KEYS = ('_about', 'art', 'release')


# ---- helpers (a game's own page builder uses these) ----

def theme_def(tid, gid=None):
    d = json.load(open(os.path.join(gamepaths.theme_dir(tid, gid), 'theme.json'), encoding='utf-8')); d.pop('_about', None); return d


def theme_art(tid, gid=None):
    """{asset name: file path, relative to the game's folder} for a theme's art (theme_<stem>)."""
    gdir = gamepaths.game_dir(gid or gamepaths.DEFAULT)
    return {'theme_' + os.path.splitext(os.path.basename(f))[0]: os.path.relpath(f, gdir) for f in sorted(glob.glob(os.path.join(gamepaths.theme_dir(tid, gid), 'art', '*')))
            if os.path.splitext(f)[1] in MIME}


def theme_fonts(tid, gid=None):
    links = theme_def(tid, gid)['fonts'].get('links', [])
    pre = sorted({'/'.join(u.split('/')[:3]) for u in links} | ({'https://fonts.gstatic.com'} if any('fonts.googleapis.com' in u for u in links) else set()))
    return (''.join(f'<link rel="preconnect" href="{h}"' + (' crossorigin' if 'gstatic' in h else '') + '>\n' for h in pre)
            + ''.join(f'<link rel="stylesheet" href="{u}">\n' for u in links))


def shell(name, tid, gid=None):
    """core/shell.html with the game's name and the theme's fonts filled in."""
    s = open(os.path.join(FW, 'core', 'shell.html'), encoding='utf-8').read().replace('<!--GAME_NAME-->', name).replace('<!--THEME_FONTS-->\n', theme_fonts(tid, gid))
    assert '<!--THEME_FONTS-->' not in s
    return s


def code_files(gid):
    """(core files, every other file) of the game's code in build order: see the module's docstring."""
    files = gamepaths.source_files(gid)
    core = [f for f in files if os.path.basename(f).startswith('01')]
    assert files[:len(core)] == core, 'only the core may have files whose names start with 01'
    return core, files[len(core):]


def engine_code(game, tid, gid=None):
    """`const GAME`, `const THEME_DEF` and the game's code, joined: core, theme, the rest (file-name order)."""
    core, rest = code_files(gid or gamepaths.DEFAULT)
    theme = sorted(glob.glob(os.path.join(gamepaths.theme_dir(tid, gid), '*.js')))
    return ('const GAME=' + json.dumps(game, ensure_ascii=False) + ';\nconst THEME_DEF=' + json.dumps(theme_def(tid, gid), ensure_ascii=False) + ';\n'
            + '\n'.join(open(f, encoding='utf-8').read() for f in core + theme + rest))


def copy_asset(source, target):
    """Hard link (a copy where links fail): the pages' img/ and audio/ folders cost no disk. Never write into such a file in place."""
    if os.path.exists(target): os.remove(target)
    try:
        os.link(source, target)
        return target
    except OSError:
        return shutil.copy(source, target)


def name_of(game):
    return game.get('name') or game['title'].title()


# ---- the framework's pages for a game that has no page builder of its own ----

def build(gid, out=None):
    gdir = gamepaths.game_dir(gid)
    game = json.load(open(os.path.join(gdir, 'game.json'), encoding='utf-8'))
    assert game.get('id') == gid or gid == 'sample-game', f'{gdir}/game.json has id {game.get("id")!r}'
    gid = game['id']
    for k in BUILD_ONLY_KEYS: game.pop(k, None)
    tid = game.get('theme', 'plain')
    code = engine_code(game, tid, gid)
    A = os.path.join(gdir, 'assets', 'game')
    out = out or gamepaths.pub_dir(gid)
    imgs, auds, scenes = {}, {}, {}
    for d in ('img', 'audio'):
        os.makedirs(os.path.join(out, d), exist_ok=True)
        for f in glob.glob(os.path.join(out, d, '*')): os.remove(f)
    for f in sorted(glob.glob(os.path.join(A, '*'))):
        base = os.path.basename(f)
        if base.endswith('.scene.json'):   # the tools' notes in the file (keys starting with _) are not shipped, as game.json's _about is not
            scenes[base[:-len('.scene.json')]] = {k: v for k, v in json.load(open(f, encoding='utf-8')).items() if not k.startswith('_')}; continue
        n, e = os.path.splitext(base)
        if e in MIME: copy_asset(f, os.path.join(out, 'img', base)); imgs[n] = 'img/' + base
        elif e in AUDIO: copy_asset(f, os.path.join(out, 'audio', base)); auds[n] = 'audio/' + base
    for k, f in theme_art(tid, gid).items():
        e = os.path.splitext(f)[1]; copy_asset(os.path.join(gdir, f), os.path.join(out, 'img', k + e)); imgs[k] = 'img/' + k + e
    meta_f = os.path.join(A, 'meta.json')
    meta = json.load(open(meta_f, encoding='utf-8')) if os.path.exists(meta_f) else {}
    js = ('window.AUDIO_SRC=' + json.dumps(auds) + ';\nconst ASSET_SRC=' + json.dumps(imgs) + ';\nconst ASSET_META=' + json.dumps(meta) +
          ';\nconst SCENE_JSON=' + json.dumps(scenes) + ';\n' + code)
    sh = shell(name_of(game), tid, gid)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(sh + '\n<script>\n' + js + '\n</script>\n')
    open(os.path.join(out, 'test.html'), 'w', encoding='utf-8').write(HEAD + sh + '\n<script>\n' + js + '\n</script>\n</body></html>')
    print(f'{os.path.basename(out)}: {len(gamepaths.source_files(gid))} code files, {len(imgs)} images, {len(auds)} audio, {len(scenes)} scenes,',
          os.path.getsize(os.path.join(out, 'index.html')), 'bytes')
    return out
