"""Wire a game's app-made art (Ronin job fw-F5a, 29 Oct 2026; gap G12).

    npx eraforge run wire_art [--game <id>] /tmp/art       # every original found in /tmp/art; missing ones are skipped

The game's art.json (beside its game.json) says what its art is; the originals are named exactly as in that list:
    paintings  { name: [w, h, quality] }   name.png -> assets/game/name.webp resized to w x h (null = full size)
    ground     [name, ...]                  the model's walkable-ground layers (white = walkable): kept in raw/ for `scene_tool.py trace`
    chars      { cast id: figure height }   char_<id>.png (3 x 3 walk sheet on magenta) -> tools/make_char.py <id> <height> fit
    poses      { cast id: figure height }   pose_<id>.png (3 x 2 battle poses on magenta) -> tools/make_pose.py
    portraits  [cast id, ...]               portrait_<id>.png (transparent) -> tools/make_portrait.py
Originals are copied unchanged to <game>/assets/raw/ (git-ignored; they go to the game's assets repo) and processed
into <game>/assets/game/, which the build reads. The scripts only key, crop and fit; they never paint. A file that lands replaces its
stand-in (core/01e_standin.js) automatically: the engine paints a stand-in only for a name the build did not find.
"""
import json, os, shutil, subprocess, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamepaths

ROOT = gamepaths.ROOT
TOOLS = os.path.dirname(os.path.abspath(__file__))


def main(gid, src):
    gdir = gamepaths.game_dir(gid)
    cfg_path = os.path.join(gdir, 'art.json')
    if not os.path.isfile(cfg_path): raise SystemExit(f'{os.path.relpath(cfg_path, ROOT)} is missing: list the game\'s paintings, chars, poses and portraits there')
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    raw, out = os.path.join(gdir, 'assets', 'raw'), os.path.join(gdir, 'assets', 'game')
    os.makedirs(raw, exist_ok=True); os.makedirs(out, exist_ok=True)
    done, missing = [], []

    def take(name):
        f = os.path.join(src, name + '.png')
        if not os.path.exists(f): missing.append(name); return None
        dst = os.path.join(raw, name + '.png'); shutil.copyfile(f, dst); return dst

    def slicer(tool, *args):
        subprocess.run([sys.executable, os.path.join(TOOLS, tool), '--game', gid, *map(str, args)], cwd=ROOT, check=True, env=gamepaths.tool_env())

    for name, (w, h, q) in cfg.get('paintings', {}).items():
        f = take(name)
        if not f: continue
        im = Image.open(f).convert('RGB')
        if w: im = im.resize((w, h), Image.LANCZOS)
        im.save(os.path.join(out, name + '.webp'), quality=q, method=6); done.append(name)
    for name in cfg.get('ground', []):
        if take(name): done.append(name + ' (kept for tracing)')
    for cast, hgt in cfg.get('chars', {}).items():
        if take('char_' + cast): slicer('make_char.py', cast, hgt, 'fit'); done.append('char_' + cast)
    for cast, hgt in cfg.get('poses', {}).items():
        if take('pose_' + cast): slicer('make_pose.py', cast, hgt); done.append('pose_' + cast)
    for cast in cfg.get('portraits', []):
        if take('portrait_' + cast): slicer('make_portrait.py', cast); done.append('portrait_' + cast)
    print('wired:', ', '.join(done) or 'nothing'); print('not found (stand-ins stay):', ', '.join(missing) or 'none')


if __name__ == '__main__':
    gid = gamepaths.pop_game()
    args = sys.argv[1:]
    main(gid, args[0] if args else '/tmp/art')
