"""Where the framework is, which game a tool works on, and where that game keeps things (Eraforge; job fw-F5, 29 Oct 2026).

Two roots:
  FW         the framework: this package (node_modules/eraforge in a game repo), or the checkout FW_PATH names (local co-development:
             `FW_PATH=../era-forge npx eraforge build`)
  GAME_ROOT  the game: $ERAFORGE_GAME if set (the `eraforge` command and the game's own entry points set it), else the nearest folder
             at or above the working directory that holds a game.json, else the framework's own sample-game/ (so the framework checkout
             builds and tests its sample game with no flags)

A game's folder holds game.json, src/*.js (its own code, joined with the engine in file-name order), assets/game/ (what the build reads),
assets/raw/ (originals, git-ignored) and, optionally, eraforge.json, the framework settings that are not game data (never shipped in a page):
  { "pub": "pub_ch1",            the folder the build writes the game's page, img/ and audio/ to (default pub_<id>)
    "build": "tools/x.py",        the game's own page builder (default: the framework's pages, tools/build.py); it imports build.py's helpers
    "config": "tools",            the folder of the per-tool settings files (catalogue.json, scene_tool.json, ...; default: beside game.json)
    "tests": "tests/tests.json",  the test catalogue (default tests.json beside game.json)
    "host": ["cincinnatus"] }     other games the site builder hosts at /games/<id>/ (ids: the framework's sample game, or games/<id>/)

Every tool takes `--game <id>`: the current game's id (the default), the sample game's id, or games/<id>/ under the game root.
    gid = gamepaths.use_game()                  # at the top of a slicer: cwd is now the game's folder
    gamepaths.pub(gid)                          # 'pub_ch1' or 'pub_<id>': the built pages, inside the game's folder
    gamepaths.config(gid, 'scene_tool.json')    # the game's per-tool settings file
    gamepaths.game_json(gid)                    # the parsed game.json
"""
import json, os, sys

FW = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # (FW_PATH is applied by the launchers, which run that checkout's tools)
SAMPLE = os.path.join(FW, 'sample-game')


def _find_game():
    if os.environ.get('ERAFORGE_GAME'): return os.path.abspath(os.environ['ERAFORGE_GAME'])
    d = os.getcwd()
    while True:
        if os.path.isfile(os.path.join(d, 'game.json')): return d
        up = os.path.dirname(d)
        if up == d: return SAMPLE
        d = up


GAME_ROOT = _find_game()
ROOT = GAME_ROOT   # the folder tools write relative paths against (the game's)


def _json(path, default=None):
    if not os.path.isfile(path): return {} if default is None else default
    with open(path, encoding='utf-8') as f: return json.load(f)


SETTINGS = _json(os.path.join(GAME_ROOT, 'eraforge.json'))
DEFAULT = _json(os.path.join(GAME_ROOT, 'game.json')).get('id') or os.path.basename(GAME_ROOT)
SAMPLE_ID = _json(os.path.join(SAMPLE, 'game.json')).get('id', 'sample')


def pop_game(argv=None):
    """Remove `--game <id>` (or `--game=<id>`) from argv (default sys.argv) and return the id, or the current game's."""
    argv = sys.argv if argv is None else argv
    for i, a in enumerate(argv):
        if a == '--game':
            if i + 1 >= len(argv): raise SystemExit('--game needs a game id')
            gid = argv[i + 1]; del argv[i:i + 2]; return gid
        if a.startswith('--game='):
            del argv[i]; return a.split('=', 1)[1]
    return DEFAULT


def game_dir(gid):
    if gid == DEFAULT: d = GAME_ROOT
    elif gid in (SAMPLE_ID, 'sample-game'): d = SAMPLE
    else: d = os.path.join(GAME_ROOT, 'games', gid)
    if not os.path.isfile(os.path.join(d, 'game.json')): raise SystemExit(f'no game {gid!r}: {os.path.join(d, "game.json")} is missing')
    return d


def settings(gid):
    """The game's eraforge.json (empty when it has none)."""
    return SETTINGS if gid == DEFAULT else _json(os.path.join(game_dir(gid), 'eraforge.json'))


def use_game(argv=None):
    gid = pop_game(argv)
    os.chdir(game_dir(gid))
    return gid


def pub(gid):
    """The folder (inside the game's folder) the build writes the game's pages and shared img/ audio/ to."""
    return settings(gid).get('pub') or 'pub_' + (SAMPLE_ID if gid == 'sample-game' else gid)


def pub_dir(gid):
    return os.path.join(game_dir(gid), pub(gid))


def config(gid, name):
    """A per-tool settings file of the game: in its eraforge.json `config` folder, else beside its game.json."""
    return os.path.join(game_dir(gid), settings(gid).get('config', '.'), name)


def tests_json(gid):
    return os.path.join(game_dir(gid), settings(gid).get('tests', 'tests.json'))


def game_json(gid):
    return _json(os.path.join(game_dir(gid), 'game.json'))


def games():
    """Every game the site builder serves: the current game first, then the ones its eraforge.json hosts."""
    return [DEFAULT] + [g for g in SETTINGS.get('host', []) if g != DEFAULT]


# ---- the engine's files ----
KIT_DIRS = ('topdown', 'battle-turn', 'minigame')   # the kits this release has (kits/<kit>/*.js)


def engine_files(game):
    """{basename: path} of the engine code a game gets: core/ + systems/ + kits/<kit>/ for each kit its game.json names."""
    out = {}
    folders = ['core', 'systems']
    for kit in game.get('kits', []):
        if not os.path.isdir(os.path.join(FW, 'kits', kit)): raise SystemExit(f'kit {kit!r} (game.json kits) is not in {os.path.join(FW, "kits")}')
        folders.append(os.path.join('kits', kit))
    for d in folders:
        for f in sorted(os.listdir(os.path.join(FW, d))):
            if f.endswith('.js'): out[f] = os.path.join(FW, d, f)
    return out


def source_files(gid=None):
    """Every JavaScript file of the game's page in build order (by file name): the engine's and the game's own src/*.js."""
    gid = gid or DEFAULT
    eng = engine_files(game_json(gid))
    own_dir = os.path.join(game_dir(gid), 'src')
    own = {f: os.path.join(own_dir, f) for f in sorted(os.listdir(own_dir)) if f.endswith('.js')} if os.path.isdir(own_dir) else {}
    clash = sorted(set(eng) & set(own))
    if clash: raise SystemExit(f'the game\'s src/ has files the engine already has: {", ".join(clash)}')
    allf = dict(eng, **own)
    return [allf[k] for k in sorted(allf)]


def source(name, gid=None):
    """The path of one source file by name (src/<name> of old): the game's own, else the engine's (core/, systems/, kits/), else the
    framework's other files (shell.html, editor.html)."""
    gid = gid or DEFAULT
    own = os.path.join(game_dir(gid), 'src', name)
    if os.path.isfile(own): return own
    for p in source_files(gid):
        if os.path.basename(p) == name: return p
    for d in ('core', 'kits/topdown'):
        p = os.path.join(FW, d, name)
        if os.path.isfile(p): return p
    raise SystemExit(f'no source file {name!r} in the game or the engine')


def themes(gid=None):
    """{theme id: folder} of every theme the game can use: the framework's (themes/plain) and the game's own themes/<id>/."""
    out = {}
    for base in (os.path.join(FW, 'themes'), os.path.join(game_dir(gid or DEFAULT), 'themes')):
        if not os.path.isdir(base): continue
        for t in sorted(os.listdir(base)):
            if os.path.isfile(os.path.join(base, t, 'theme.json')): out[t] = os.path.join(base, t)
    return out


def theme_dir(tid, gid=None):
    t = themes(gid)
    if tid not in t: raise SystemExit(f'theme {tid!r} is in neither the game\'s themes/ nor the framework\'s (have: {", ".join(t)})')
    return t[tid]


def tool_env(gid=None):
    """The environment for a game tool run as a subprocess: it finds this framework and this game, and can import the framework's tools."""
    env = dict(os.environ, PYTHONUTF8='1', ERAFORGE_ROOT=FW, ERAFORGE_GAME=game_dir(gid or DEFAULT))
    env['PYTHONPATH'] = os.pathsep.join([os.path.join(FW, 'tools'), os.path.join(FW, 'testkit')] + ([env['PYTHONPATH']] if env.get('PYTHONPATH') else []))
    return env
