"""Build playable category animation test sheets; never modifies artwork.

python tools/make_animation_category_review.py [--category forge] [--output shots/animations]
python tools/make_animation_category_review.py --check
`--game <id>` builds another game's sheets (default: the current game): its animation_reviews.json (in its config folder, see gamepaths)
and its assets/game. Optional manifest keys: "measurements" (a JSON file in the game's folder with socket tips per sheet cell) and
"inserts" (a module in the game's tools/ whose generate(folder) writes a playable page of close-up stills at <output>/inserts/).
"""
import argparse
import base64
import json
import re
import struct
from html import escape
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamepaths

FW = Path(gamepaths.FW)
ROOT = Path(gamepaths.GAME_ROOT)
GAME = gamepaths.DEFAULT
GAME_DIR = ROOT                                               # the game's folder: its assets/game is what the sheets are read from
MANIFEST = Path(gamepaths.config(gamepaths.DEFAULT, 'animation_reviews.json'))


def use_game(gid):
    """Point the builder at another game's manifest and art (before catalog() / generate())."""
    global GAME, GAME_DIR, MANIFEST
    GAME, GAME_DIR, MANIFEST = gid, Path(gamepaths.game_dir(gid)), Path(gamepaths.config(gid, 'animation_reviews.json'))
    if not MANIFEST.is_file(): raise SystemExit(f'no animation_reviews.json for game {gid!r} ({MANIFEST.relative_to(ROOT)})')


def game_path(rel):
    """A path in the game's folder; `games/<id>/...` that is not there names a game the site hosts (gamepaths.game_dir: the framework's
    sample game, or games/<id>/), so a category can show another game's sheets. Only those folders may be read."""
    path = (GAME_DIR/rel).resolve()
    allowed = [GAME_DIR.resolve()]
    m = re.match(r'games/([^/]+)/(.*)', rel)
    if m and m.group(1) in gamepaths.games():
        other = Path(gamepaths.game_dir(m.group(1))).resolve(); allowed.append(other)
        if not path.exists(): path = (other/m.group(2)).resolve()
    return path if any(path.is_relative_to(a) for a in allowed) else None


def atlas_root(category):
    path = game_path(category.get('assetRoot', 'assets/game'))
    if path is None:
        raise ValueError('Atlas assets must be inside the repo')
    return path


def merge_hosted(data):
    """Job fw-F7: a site that hosts other games (eraforge.json `host`) shows their animation test sheets too. Each hosted game keeps its own
    animation_reviews.json; its categories are added after the host's own, with their art and scenes read from `games/<id>/` (game_path)."""
    if GAME != gamepaths.DEFAULT: return
    for hid in gamepaths.games()[1:]:
        path = Path(gamepaths.config(hid, 'animation_reviews.json'))
        if not path.is_file(): continue
        other = json.loads(path.read_text(encoding='utf-8'))
        if other.get('version') != 1: raise ValueError(f'{hid}: unsupported animation review manifest version')
        for slug, category in other['categories'].items():
            if slug in data['categories']: raise ValueError(f'{hid}: category {slug!r} is already in the host\'s animation_reviews.json')
            category['assetRoot'] = f'games/{hid}/' + category.get('assetRoot', 'assets/game')
            for clip in category.get('clips', []):
                if 'scene' in clip:
                    scene = clip['scene']; scene['background'] = f'games/{hid}/' + scene['background']
            data['categories'][slug] = category


def catalog():
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if data.get('version') != 1:
        raise ValueError('Unsupported animation review manifest version')
    merge_hosted(data)
    sheets, coverage = {}, {}
    for slug, category in data['categories'].items():
        if not re.fullmatch(r'[a-z0-9-]+', slug):
            raise ValueError(f'Invalid category slug {slug}')
        ids = set()
        for clip in category.get('clips', []):
            name = clip['sheet']
            if Path(name).name != name or Path(name).suffix not in ('.png','.webp'):
                raise ValueError(f'Invalid atlas file {name}')
            if clip['id'] in ids:
                raise ValueError(f'{slug}: duplicate clip id {clip["id"]}')
            ids.add(clip['id'])
            path = atlas_root(category)/name
            cols, rows = clip['grid']
            # Hosting builds need only the standard library. PNG headers carry
            # dimensions; WebP entries declare cell size, checked on browser decode.
            with path.open('rb') as source:
                header = source.read(24)
            if header[:8] == b'\x89PNG\r\n\x1a\n':
                width, height = struct.unpack('>II',header[16:24])
            elif path.suffix == '.webp' and 'cell' in clip:
                width, height = clip['cell'][0]*cols, clip['cell'][1]*rows
            else:
                raise ValueError(f'{name}: provide cell dimensions for WebP')
            if cols < 1 or rows < 1 or width % cols or height % rows:
                raise ValueError(f'{name}: grid does not divide the atlas')
            cells = clip.get('frameCount', cols*rows)
            if not 1 <= cells <= cols*rows:
                raise ValueError(f'{name}: invalid frame count')
            layout = (cols, rows, cells)
            if name in sheets and sheets[name] != layout:
                raise ValueError(f'{name}: conflicting grid/frame count')
            sheets[name] = layout
            frames, durations = clip['frames'], clip['durations']
            if not frames or len(frames) != len(durations):
                raise ValueError(f'{slug}/{clip["id"]}: frame/duration mismatch')
            if any(type(f) is not int or not 0 <= f < cells for f in frames):
                raise ValueError(f'{name}: frame outside declared count')
            if any(type(ms) not in (int,float) or ms <= 0 for ms in durations):
                raise ValueError(f'{name}: non-positive frame duration')
            if clip['mode'] not in ('loop','once','poses'):
                raise ValueError(f'{name}: invalid playback mode')
            clip['cell'] = [width//cols, height//rows]
            coverage.setdefault(name,set()).update(frames)
        for link in category.get('engineTests', []):
            if not link['url'].startswith(('/test/', '/games/')) or '"' in link['url']:   # job fw-F6: a second game's page (/games/<id>/) counts as local
                raise ValueError('Engine test must link to a local /test/ or /games/ route')
    for name, (_,_,cells) in sheets.items():
        missing = set(range(cells))-coverage[name]
        if missing:
            raise ValueError(f'{name}: unreviewed frames {sorted(missing)}')
    for path in (GAME_DIR/'assets/game').iterdir():
        if path.suffix not in ('.png','.webp') or not path.stem.startswith(('anim_','fx_')):
            continue
        if any(path.name.startswith(pre) for pre in data.get('reviewedElsewhere',{}).get('prefixes',[])):
            continue
        if path.name not in sheets and not data.get('nonAnimated',{}).get(path.name):
            raise ValueError(f'{path.name}: animation has no playback registration; add it to animation_reviews.json')
    return data


def generate(output=None, categories=None):
    data = catalog()
    output = Path(output) if output else ROOT/'shots/animations'
    name = gamepaths.game_json(GAME).get('name') or GAME
    template = (FW/'tools/site/animation-category-review.html').read_text(encoding='utf-8').replace('__GAME__', escape(name))
    reportpath = GAME_DIR/data['measurements'] if data.get('measurements') else None
    measurements = json.loads(reportpath.read_text(encoding='utf-8')) if reportpath and reportpath.exists() else {}
    for slug, category in data['categories'].items():
        if categories and slug not in categories:
            continue
        payload = dict(category)
        payload['slug'] = slug
        payload['sheets'], payload['sockets'] = {}, {}
        payload['sceneImages'] = {}
        for clip in category.get('clips', []):
            if 'scene' in clip:
                scene = clip['scene']
                for asset in (scene['background'], 'assets/game/'+scene['handle']):
                    path = game_path(asset)
                    if path is None:
                        raise ValueError('Scene image must be inside the repo')
                    payload['sceneImages'][asset] = 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
            name = clip['sheet']
            if name in payload['sheets']:
                continue
            path = atlas_root(category)/name
            mime = 'image/png' if path.suffix == '.png' else 'image/webp'
            payload['sheets'][name] = f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
            if path.stem in measurements:
                payload['sockets'][name] = {str(c['cell']):c['tips'] for c in measurements[path.stem]['cells']}
        serialized = json.dumps(payload,ensure_ascii=False).replace('<','\\u003c')
        html = template.replace('__TITLE__',escape(category['title'])).replace('__DATA__',serialized)
        path = output/slug/'index.html'; path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(html,encoding='utf-8')
        print(f'{path}: {len(category.get("clips",[]))} playable clips')
    cards = ''.join(f'<li><a href="./{slug}/">{escape(c["title"])}</a></li>' for slug,c in data['categories'].items())
    if data.get('inserts'):   # close-up stills with their own playable page next to the atlas categories (the game's own module)
        sys.path.insert(0, str(GAME_DIR/'tools'))
        __import__(data['inserts']).generate(output/'inserts'); cards += '<li><a href="./inserts/">Close-up inserts (Job 18d): playable dissolves and drift</a></li>'
    output.mkdir(parents=True,exist_ok=True)
    (output/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(gamepaths.game_json(GAME).get('name') or 'Game')+' · Animation test sheets</title><body style="background:#1b1b20;color:#eee;font:18px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px"><h1>Animation test sheets</h1><p>Separate category pages, with actual playback, slow speed and frame stepping.</p><ul>'+cards+'</ul><a style="color:#e2b46d" href="/test/">All game tests</a></body></html>',encoding='utf-8')
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--category', action='append')
    parser.add_argument('--output',type=Path)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--game',default=gamepaths.DEFAULT)
    args = parser.parse_args()
    use_game(args.game)
    if args.check:
        data = catalog()
        print('Animation review catalog valid:',len(data['categories']),'categories')
    else:
        if args.category and set(args.category)-set(catalog()['categories']):
            parser.error('Unknown animation category')
        generate(args.output,args.category)
