# One command for the per-scene asset steps that used to be one near-copied script per scene (jobs fw-C2 and fw-C2b, 28 Oct 2026).
# Each scene's settings live in the game's scene_tool.json (its config folder); this file holds the shared steps. It is the top-down kit's
# scene command, `npx eraforge scene <step> ...` (Eraforge since job fw-F5; a game's own named steps are its scene_hooks.py).
#
#   python3 tools/scene_tool.py mask <scene>          walkable-only export (green on black, from the painter or the app) -> assets/game/<scene>.walk.json
#   python3 tools/scene_tool.py painter <scene>       the Ground Painter page for Ash (the painting + the model's ground map in green) -> gp_<scene>_ground_painter.html
#   python3 tools/scene_tool.py painter <scene> --fg  the Foreground Painter page (painting, audited ground in green, the model's or today's cut-outs in magenta)
#   python3 tools/scene_tool.py fg <scene>            the model's or Ash's foreground mask -> cut-out sheet <scene>_fg.webp + <scene>_fg_slices.json (+ the game painting)
#   python3 tools/scene_tool.py link <a> <b>          apply the declared link between two scenes (door or exit, both ends) to their scene JSON
#   python3 tools/scene_tool.py mask|painter|fg|link all   every scene (or link) that has settings for that step
#   python3 tools/scene_tool.py trace <scene>         the image model's ground layer (white = walkable) -> walk / nowalk in assets/game/<scene>.scene.json (job fw-F5a: was games/cincinnatus/tools/trace_ground.py)
#   python3 tools/scene_tool.py list                  the scenes and which steps each one has
#   Every step takes `--game <id>` (default: the current game): the game's assets/raw and assets/game, and its settings file scene_tool.json
#   (see tools/gamepaths.py: `config`).
#
# mask replaces walk_mask_<scene>.py (17 scripts, archived in tools/archive/): keep the green region connected to the start, close and
# open small gaps, optionally drop specks, trim edges or cut extra holes, erode for the feet, and write the outline (and the holes, and
# any "secret" islands) in the painting's own pixels. A scene's quirks are settings, not code; the town keeps its one named hook.
# painter replaces make_gp_<scene>.py, make_fgp_<scene>.py and make_road_ground_page.py (fw-C2b): one page builder over the templates in
# kits/topdown/painters/ (v1 and v2 Ground Painter) or the game's own (a road ground audit, a Foreground Painter); the page's text is in the settings.
# fg replaces make_fg.py, make_fg_<scene>.py, make_fg_room_<scene>.py and refine_fg_<scene>.py (fw-C2b): it only CUTS what the image model
# or Ash made (a magenta model layer or Ash's magenta-on-black mask); the pixels always come from the original painting. The town keeps
# its named hook (fg_town_lib.py: the bridge cut and the tree slice). No new masks are drawn here.
# link replaces link_town_<room>.py, link_town_battlefield.py and link_shrine_hall.py (fw-C2b): links are declared in the scene settings
# ("link": {other scene: [edits]}) and re-running one is a no-op.
# Art layers are still made by the image model or by Ash in the app: these steps only trace, cut and place what they made.
import base64, io, json, os, re, sys
import cv2, numpy as np
from PIL import Image
import gamepaths

ROOT = gamepaths.GAME_ROOT
CONFIG = gamepaths.config(gamepaths.DEFAULT, 'scene_tool.json')
PAINTERS = os.path.join(gamepaths.FW, 'kits', 'topdown', 'painters')   # the framework's painter templates
GAME = gamepaths.DEFAULT


def hooks():
    """The game's own steps, scene_hooks.py in its config folder (MASK_HOOKS, FG_HOOKS, REFINE), for settings that name a hook."""
    path = gamepaths.config(GAME, 'scene_hooks.py')
    if not os.path.isfile(path): raise SystemExit(f'scene settings name a hook, and the game has no {path}')
    sys.path.insert(0, os.path.dirname(path))
    import scene_hooks
    return scene_hooks


def template(path):
    """A painter template: the game's own file (relative to its folder), else the framework's of the same name."""
    own = os.path.join(gamepaths.game_dir(GAME), path)
    return own if os.path.isfile(own) else os.path.join(PAINTERS, os.path.basename(path))


def load_config(path=CONFIG):
    with open(path, encoding='utf-8') as f:
        return {k: v for k, v in json.load(f).items() if not k.startswith('_')}


def _window(spec):
    """[y0, y1, x0, x1] with null for open ends -> a 2-D slice."""
    y0, y1, x0, x1 = spec
    return (slice(y0, y1), slice(x0, x1))


def _polys(mask, minarea, to_painting):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    walk, hole = [], []
    if hier is None: return walk, hole
    for c, h in zip(cs, hier[0]):
        if cv2.contourArea(c) < minarea: continue
        a = to_painting(cv2.approxPolyDP(c, 1.5, True)[:, 0, :])
        if len(a) >= 3: (hole if h[3] >= 0 else walk).append(a.tolist())
    return walk, hole


def mask(sid, cfg, out_dir='assets/game', shots_dir='shots', quiet=False):
    c = cfg[sid]['mask']
    W, H = c.get('size', [1920, 1080])
    g = np.asarray(Image.open(c['src']).convert('RGB').resize((W, H), Image.LANCZOS)).astype(int)
    if c.get('hook'):
        return hooks().MASK_HOOKS[c['hook']](sid, c, g, out_dir, shots_dir, quiet)
    sc = c['scale']
    if 'painting_w' in sc:   # rooms and key screens: mask px / F, rounded (F = mask width / painting width)
        F = W / sc['painting_w']
        to_painting = lambda a: np.round(a / F).astype(int)
        start_out = lambda x, y: [int(x / F), int(y / F)]
    else:                    # areas: mask px x mul (the 4K painting at half size)
        F, k = None, sc['mul']
        to_painting = lambda a: a * k
        start_out = lambda x, y: [int(x * k), int(y * k)]
    green = ((g[..., 1] > 150) & (g[..., 0] < 140) & (g[..., 2] < 140)).astype(np.uint8)
    m = cv2.morphologyEx(green, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    o = c.get('open', 5)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((o, o), np.uint8))
    if 'specks' in c:        # drop islands of at most this many mask px
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
        for i in range(1, n):
            if st[i, 4] <= c['specks']: m[lab == i] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if 'start_painting' in c:
        SX, SY = int(c['start_painting'][0] * F), int(c['start_painting'][1] * F)
    else:
        SX, SY = c['start']
    if lab[SY, SX] == 0:     # the start fell outside the green: nearest green pixel inside the search window
        ys_, xs_ = _window(c.get('search', [None, None, None, None]))
        oy, ox = ys_.start or 0, xs_.start or 0
        ys, xs = np.nonzero(m[ys_, xs_])
        i = np.argmin((xs + ox - SX) ** 2 + (ys + oy - SY) ** 2)
        SX, SY = int(xs[i] + ox), int(ys[i] + oy)
    main = lab[SY, SX]
    keep = (lab == main).astype(np.uint8)
    for _ in range(c.get('extra_largest', 0)):   # also keep the largest other region(s): the cave's upper level, reached by a warp
        other = [i for i in (np.argsort(-st[1:, 4]) + 1) if i != main and not keep[lab == i].any()][0]
        keep |= (lab == other).astype(np.uint8)
    for t in c.get('trim', []): keep[_window(t)] = 0
    walkable = cv2.erode(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    for cx, cy, ax, ay in c.get('cut_ellipses', []): cv2.ellipse(walkable, (cx, cy), (ax, ay), 0, 0, 360, 0, -1)
    if shots_dir:
        os.makedirs(shots_dir, exist_ok=True); cv2.imwrite(os.path.join(shots_dir, sid + '_walkmask.png'), walkable * 255)
    walk, hole = _polys(walkable, 60, to_painting)
    out = {'walk': walk, 'nowalk': hole}
    islands = []
    for i in range(1, n):
        if i == main or keep[lab == i].any(): continue
        comp = (lab == i).astype(np.uint8)
        if comp.sum() < 150: continue
        islands.append((i, int(comp.sum()), cv2.boundingRect(comp)))
        if c.get('secrets'):  # islands left unconnected on purpose: not walkable, kept as "secret" polygons for later jumps
            comp = cv2.erode(comp, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
            w, _ = _polys(comp, 20, to_painting)
            if w: out.setdefault('secret', []).append({'poly': w[0], 'px': int(comp.sum())})
    if c.get('secrets') and 'secret' not in out: out['secret'] = []
    out['start'] = start_out(SX, SY)
    dest = os.path.join(out_dir, c.get('out', sid + '.walk.json'))
    with open(dest, 'w') as f: json.dump(out, f)
    if not quiet:
        print(f"{sid}: {len(walk)} walk, {len(hole)} holes" + (f", {len(out['secret'])} secret" if 'secret' in out else '') +
              f", start {out['start']} -> {dest}")
        for i, px, box in islands: print(f'  other island {i}: {px} px, bbox {box}')
    return dest


# ---------------------------------------------------------------------------------------------------------------------------------
# painter (job fw-C2b): the Ground Painter and Foreground Painter pages Ash audits in the browser. Kept exactly as the retired
# make_gp_<scene>.py / make_fgp_<scene>.py / make_road_ground_page.py built them; only the template and the text differ per scene.

def _first(path):
    """A path, or a list of candidates (the first that exists: a placeholder thumb until the original arrives)."""
    if isinstance(path, str): return path
    for p in path:
        if os.path.exists(p): return p
    return path[-1]


def _durl(im, fmt, **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw)
    return 'data:image/%s;base64,%s' % (fmt.lower(), base64.b64encode(b.getvalue()).decode())


def _raw_url(path):   # the model original embedded unchanged (the road ground audit)
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def _green(path, rule, fit, W=1920, H=1080):
    """The ground layer in green. rule 'model': the model's ground map (green clearly above red and blue); 'audited': Ash's
    walkable-only export (green on black). fit 'nearest': resized to the layer first; 'lanczos': judged at its own size, alpha resized."""
    im = Image.open(path).convert('RGB')
    if fit == 'nearest': im = im.resize((W, H), Image.NEAREST)
    g = np.array(im).astype(int)
    gm = ((g[..., 1] - np.maximum(g[..., 0], g[..., 2])) > 60) if rule == 'model' else ((g[..., 1] > 128) & (g[..., 0] < 100))
    ga = np.zeros((H, W, 4), np.uint8); ga[..., 1] = 255
    if fit == 'nearest': ga[..., 3] = (gm * 255).astype(np.uint8)
    else: ga[..., 3] = np.array(Image.fromarray((gm * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS))
    return _durl(Image.fromarray(ga, 'RGBA'), 'PNG', optimize=True)


def _model_fg_keep(path):
    """The model's foreground layer (kept objects, the rest flat magenta), cleaned: specks and pinholes go (retired make_fgp_*.py)."""
    from scipy import ndimage as ndi
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    keep = ~((a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 120))
    keep = ndi.binary_opening(keep, iterations=2)
    lab, n = ndi.label(keep); sz = ndi.sum(keep, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 400])
    keep = ndi.binary_closing(keep, iterations=2)
    holes = ~keep
    hl, hn = ndi.label(holes); hs = ndi.sum(holes, hl, range(1, hn + 1))
    return keep | np.isin(hl, [i + 1 for i, v in enumerate(hs) if v < 600])


def painter(sid, cfg, fg=False, quiet=False):
    c = cfg[sid]['fgpainter' if fg else 'painter']
    W, H = 1920, 1080
    t = open(template(c['template']), encoding='utf-8').read()   # the game's own template, else the framework's (kits/topdown/painters/)
    if c.get('raw_images'):
        img, green = _raw_url(c['painting']), _raw_url(c['ground'])
    else:
        img = _durl(Image.open(_first(c['painting'])).convert('RGB').resize((2560, 1440), Image.LANCZOS), 'JPEG', quality=c.get('jpeg', 88))
        green = _green(c['ground'], c.get('ground_rule', 'model'), c.get('ground_fit', 'nearest'))
    if fg:
        r = c['red']
        if 'model_layer' in r:
            keep = _model_fg_keep(r['model_layer'])
            if r.get('save'): Image.fromarray((keep * 255).astype(np.uint8)).save(r['save'])
        else:   # today's cut-outs, as `fg` refines them (the game's REFINE hook the settings name)
            keep = hooks().REFINE[r['refine']](np.asarray(Image.open(r['painting']).convert('RGB')), _magenta(r['mask']), {'refine_old': r['mask_old']})
        ra = np.zeros((H, W, 4), np.uint8); ra[..., 0] = 255; ra[..., 2] = 255
        ra[..., 3] = np.array(Image.fromarray((keep * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS))
        red = _durl(Image.fromarray(ra, 'RGBA'), 'PNG', optimize=True)
        for a, b in c['text']: t = t.replace(a, b)
        t = t.replace('__IMG__', img).replace('__GREEN__', green).replace('__RED__', red)
    else:
        if '__TITLE__' in t: t = t.replace('__TITLE__', c['title'])
        elif 'title' in c:
            assert '<title>Ground Painter</title>' in t
            t = t.replace('<title>Ground Painter</title>', '<title>%s</title>' % c['title'])
        for k in ('intro', 'key', 'file', 'label', 'slug'):
            if k in c: t = t.replace('__%s__' % k.upper(), c[k])
        t = t.replace('__IMG__', img).replace('__GREEN__', green)
    assert not re.search(r'__[A-Z]+__', t), 'a placeholder is left in the page'
    assert all(a not in t for a in c.get('absent', [])), 'template text that should have been replaced is still there'
    if os.path.dirname(c['out']): os.makedirs(os.path.dirname(c['out']), exist_ok=True)
    with open(c['out'], 'w', encoding='utf-8') as f: f.write(t)
    if not quiet: print(f"{sid}: {c['out']} {len(t) / 1e6:.2f} MB")
    return c['out']


# ---------------------------------------------------------------------------------------------------------------------------------
# fg (job fw-C2b): foreground cut-outs. The model's layer (kept objects real, the rest flat magenta) or Ash's audited mask (magenta
# strokes on black) says WHICH pixels are foreground; the pixels always come from the original painting, through the same resize as
# the game painting (lesson from the battlefield, 3 Oct 2026: otherwise the cut-outs shift against the painting under them).

def _magenta(path, thr=(190, 110, 190), size=None):
    """Ash's audited mask: magenta = foreground. size: resize first (LANCZOS) when the export is not the painting's size."""
    im = Image.open(path).convert('RGB')
    if size and im.size != tuple(size): im = im.resize(tuple(size), Image.LANCZOS)
    a = np.asarray(im).astype(int)
    return ((a[..., 0] > thr[0]) & (a[..., 1] < thr[1]) & (a[..., 2] > thr[2])).astype(np.uint8)


def _area_slices(mask):
    """Area cut-outs: connected pieces at half size, cut into 64-px columns (128 painting px); each column's base is its lowest pixel."""
    H, W = mask.shape
    half = cv2.resize(mask, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(half, connectivity=8)
    slices = []; SW = 64
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 250: continue
        comp = (lab == i)
        for x0 in range(x, x + w, SW):
            x1 = min(x0 + SW, x + w)
            sub = comp[y:y + h, x0:x1]
            if not sub.any(): continue
            rows = np.where(sub.any(1))[0]
            slices.append([int(x0 * 2), int((y + rows.min()) * 2), int(x1 * 2), int((y + rows.max() + 1) * 2), int((y + rows.max()) * 2)])
    return n, slices


def _fg_area(sid, c, quiet):
    orig = Image.open(c['painting']).convert('RGB')
    src = next((s for s in c['mask'] if os.path.exists(s['src'])), c['mask'][-1])
    m = _magenta(src['src'], tuple(src.get('thr', (190, 110, 190))), orig.size if src.get('fit') else None)
    mask = (1 - m).astype(np.uint8) if src.get('kind') == 'model' else m   # a model layer: everything NOT flat magenta is foreground
    if 'refine' in c: mask = hooks().REFINE[c['refine']](np.asarray(orig), mask, c)
    if 'specks' in c:
        n, lab, st, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for i in range(1, n):
            if st[i, 4] < c['specks']: mask[lab == i] = 0
    if c.get('hook'):   # the game's own cut (Ronin's town: the bridge cut out and the big tree as one slice)
        mask, slices = hooks().FG_HOOKS[c['hook']](mask); n = None
    else:
        n, slices = _area_slices(mask)
    # Baseline overrides (4 Oct 2026, Ash: "the character is in front of something and then suddenly goes behind it"): floating pieces
    # (torii beams, canopies, a roof) get the y of the ground line they stand on. [[x0 range], [top-of-slice range], base] in preview px
    # (painting px / scale); a slice's base is only ever raised.
    S = c.get('override_scale', 1.92)
    for sl in slices:
        x0, y0 = sl[0] / S, sl[1] / S
        for (xa, xb), (ya, yb), b in c.get('base_overrides', []):
            if xa <= x0 <= xb and ya <= y0 <= yb: sl[4] = max(sl[4], int(b * S))
    sh = c['sheet']; SZ = tuple(sh['size'])
    if sh.get('mode', 'dstack') == 'dstack':
        rgba = np.dstack([np.asarray(orig), (mask * 255).astype(np.uint8)])
        Image.fromarray(rgba, 'RGBA').resize(SZ, Image.LANCZOS).save(sh['file'], lossless=True, quality=90, method=4)
    else:   # the painting's own RGB under a separately resized alpha (no halo), and the game painting from the SAME resize
        rgb = orig.resize(SZ, Image.LANCZOS)
        alpha = Image.fromarray((mask * 255).astype(np.uint8), 'L').resize(SZ, Image.LANCZOS)
        fgs = rgb.convert('RGBA'); fgs.putalpha(alpha)
        fgs.save(sh['file'], lossless=True, quality=90, method=4)
        po = c.get('painting_out')
        if po and 'alpha' in po:   # the battlefield's sky/valley cut-out alpha (from the model's magenta cut pass)
            game = rgb.convert('RGBA'); game.putalpha(Image.open(po['alpha']).convert('L'))
            game.save(po['file'], lossless=True, quality=90, method=4)
        elif po:
            rgb.save(po['file'], quality=po.get('quality', 90))
    json.dump(slices, open(c['slices'], 'w'))
    if 'shot' in c:
        vis = np.asarray(orig).copy(); vis[mask == 0] = (vis[mask == 0] * 0.25).astype(np.uint8)
        Image.fromarray(vis).resize(tuple(c['shot']['size'])).save(c['shot']['file'])
    if not quiet: print(f"{sid}: {len(slices)} slices, {mask.mean():.4f} foreground -> {sh['file']}, {c['slices']}")


def _piece_base(rule, ys, cen):
    if isinstance(rule, int): return rule
    if 'by_bottom' in rule: return rule['upper'] if ys.max() < rule['by_bottom'] else rule['lower']
    cx, cy = cen
    for xlo, xhi, ylo, yhi, b in rule['by_centroid']:
        if (xlo is None or cx > xlo) and (xhi is None or cx < xhi) and (ylo is None or cy > ylo) and (yhi is None or cy < yhi): return b
    raise ValueError(f'no base rule matches the piece at {cen}')


def _columns(m, rule, cen, PW, SW=32):
    """Room cut-outs: 32-px columns of a piece in painting px [x0, y0, x1, y1, base]; base = the piece's ground line from its rule,
    or "column" = each column's own lowest pixel."""
    ys, xs = np.nonzero(m)
    b = None if rule == 'column' else _piece_base(rule, ys, cen)
    out = []
    for x0 in range(int(xs.min()) // SW * SW, int(xs.max()) + 1, SW):
        sub = m[:, x0:x0 + SW]
        if not sub.any(): continue
        rows = np.where(sub.any(1))[0]
        out.append([x0, int(rows.min()), min(x0 + SW, PW), int(rows.max()) + 1, int(rows.max()) + 1 if b is None else b])
    return out


def _fg_room(sid, c, quiet):
    orig = Image.open(_first(c['painting'])).convert('RGB')
    PW, PH = c.get('slice_size', [1672, 941])
    if c.get('painting_size'): orig = orig.resize(tuple(c['painting_size']), Image.LANCZOS)
    masks, slices, seen = [], [], np.zeros((PH, PW), np.uint8)
    for L in c['layers']:
        f = np.asarray(Image.open(L['src']).convert('RGB')).astype(int)
        mask = (~((f[..., 0] > 200) & (f[..., 1] < 80) & (f[..., 2] > 200))).astype(np.uint8)   # the model layer: not flat magenta = kept
        if 'keep_boxes' in L:   # only these pieces of the model's layer are foreground (Ash's choice), boxes in painting px
            keep = np.zeros_like(mask); sx, sy = mask.shape[1] / PW, mask.shape[0] / PH
            for x0, y0, x1, y1 in L['keep_boxes']: keep[int(y0 * sy):int(y1 * sy), int(x0 * sx):int(x1 * sx)] = 1
            mask = mask * keep
        n, lab, st, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for i in range(1, n):
            if st[i, 4] < 150: mask[lab == i] = 0
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))   # the model's shape, a little wider (handles, rope edges)
        masks.append(mask)
        if 'piece_base' in L:   # each connected piece gets its own ground line
            n, lab, st, cen = cv2.connectedComponentsWithStats(mask, connectivity=8)
            parts = [((lab == i).astype(np.uint8), L['piece_base'], cen[i]) for i in range(1, n)]
        else:                   # whole layer, or split at x (layer px) into parts with their own ground lines
            parts = []
            for g in L.get('split', [{'base': L.get('base')}]):
                part = mask.copy(); x0, x1 = g.get('x', [None, None])
                if x1 is not None: part[:, x1:] = 0
                if x0 is not None: part[:, :x0] = 0
                parts.append((part, g['base'], None))
        for part, rule, cen in parts:
            m = cv2.resize(part, (PW, PH), interpolation=cv2.INTER_NEAREST)
            seen = np.maximum(seen, m)
            slices += _columns(m, rule, cen, PW)
    mask = masks[0]
    for m in masks[1:]: mask = np.maximum(mask, m)
    SZ = tuple(c.get('game_size', [1280, 720]))
    rgb = orig.resize(SZ, Image.LANCZOS)
    alpha = Image.fromarray((mask * 255).astype(np.uint8), 'L').resize(SZ, Image.LANCZOS)
    fgs = rgb.convert('RGBA'); fgs.putalpha(alpha)
    fgs.save(c['sheet'], lossless=True, quality=90, method=4)
    rgb.save(c['painting_out'], quality=92)
    json.dump(slices, open(c['slices'], 'w'))
    if 'shot' in c:
        vis = np.asarray(orig).copy(); vis[seen == 0] = (vis[seen == 0] * 0.25).astype(np.uint8)
        Image.fromarray(vis).save(c['shot'])
    if not quiet: print(f"{sid}: {len(slices)} slices, {mask.mean():.4f} foreground -> {c['sheet']}, {c['slices']}")


def fg(sid, cfg, quiet=False):
    c = cfg[sid]['fg']
    (_fg_room if 'layers' in c else _fg_area)(sid, c, quiet)


# ---------------------------------------------------------------------------------------------------------------------------------
# link (job fw-C2b): a door or exit that leads to another scene. Declared in the settings of one of the two scenes as
# "link": {"<other scene>": [edits]}; each edit patches one scene JSON (and, for the shrine, the generator's doors line).

def _find(items, match):
    for d in items:
        if 'r' in match and d['r'] in match['r']: return d
        if 'r1_over' in match and d['r'][1] > match['r1_over']: return d
    raise LookupError(f'no entry matches {match}')


def link(a, b, cfg, quiet=False):
    edits = cfg.get(b, {}).get('link', {}).get(a) or cfg.get(a, {}).get('link', {}).get(b)
    if not edits: raise LookupError(f'no link between {a} and {b} in scene_tool.json')
    for e in edits:
        p = e['scene']; s = json.load(open(p, encoding='utf-8'))
        if 'upsert' in e:   # replace (or add) the entry with this name
            s[e['list']] = [x for x in s[e['list']] if x.get('name') != e['upsert']['name']]
            s[e['list']].append(dict(e['upsert'])); d = e['upsert']
        else:
            d = _find(s[e['list']], e['match'])
            for k, v in e['set'].items(): d[k] = v
        json.dump(s, open(p, 'w', encoding='utf-8'))
        if 'source' in e:   # keep the scene's generator in step, so regenerating the scene keeps the link
            src = e['source']; m = open(src['file'], encoding='utf-8').read()
            m = m.replace(re.search(src['find'], m, re.S).group(0), src['with'])
            open(src['file'], 'w', encoding='utf-8').write(m)
        if not quiet: print(f"linked {a} <-> {b}: {p} {e['list']} {d['r']}")


def trace(sid, cfg, quiet=False):
    """The image model's own ground layer (white = walkable, an edit of the scene's painting on the same canvas) -> the scene's walk polygons.

    Settings (scene_tool.json -> <scene> -> trace): src = the mask png, open = opening kernel radius in px (default 5), origin = where the
    original lives (written into the scene's _note). Thresholds at mid-grey, opens to drop slivers and specks, keeps the single region
    connected to the scene's `start` (islands such as hanging herbs or a white rim on a roof are not reachable, so they go). The region's
    outline becomes `walk`, its holes (a hut, trees, a plough, a hearth) become `nowalk`; points are simplified to about 3 px and scaled to
    the scene's painting size (`iw` x `ih`). `block` is emptied (the mask carries the obstacles). Nothing is painted or invented: where the
    mask is wrong the polygons are wrong too, and the fix is a better mask from the model."""
    c = cfg[sid]['trace']; open_px = c.get('open', 5)
    p = os.path.join('assets/game', sid + '.scene.json'); d = json.load(open(p, encoding='utf-8'))
    m = cv2.imread(c['src'], cv2.IMREAD_GRAYSCALE)
    if m is None: raise SystemExit(f"{sid}: no ground mask at {c['src']}")
    h, w = m.shape; sx, sy = d['iw'] / w, d['ih'] / h
    b = (m > 127).astype(np.uint8)
    if open_px: b = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * open_px + 1, 2 * open_px + 1)))
    n, lab = cv2.connectedComponents(b, connectivity=4)
    st = (min(h - 1, int(d['start'][1] / sy)), min(w - 1, int(d['start'][0] / sx)))
    k = lab[st]
    if k == 0: raise SystemExit(f'{sid}: the start point {d["start"]} is not on walkable ground in the mask')
    keep = (lab == k).astype(np.uint8)
    cs, hier = cv2.findContours(keep, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    walk, nowalk = [], []
    for ct, hh in zip(cs, hier[0]):
        if cv2.contourArea(ct) < 300: continue
        poly = [[round(x * sx), round(y * sy)] for [[x, y]] in cv2.approxPolyDP(ct, 3, True)]
        (nowalk if hh[3] >= 0 else walk).append(poly)
    d['walk'], d['nowalk'], d['block'] = walk, nowalk, []
    where = f", {c['origin']}" if c.get('origin') else ''
    d['_note'] = f"Walkable ground traced by tools/scene_tool.py trace from the image model's ground layer ({os.path.basename(c['src'])}{where}), {open_px} px opening, the region connected to `start`. Doors, exits, things and lights are placed by hand on the painting."
    json.dump(d, open(p, 'w', encoding='utf-8'), indent=2, ensure_ascii=False); open(p, 'a').write('\n')
    if not quiet: print(f'{sid}: {len(walk)} walk polygon(s) ({sum(len(q) for q in walk)} points), {len(nowalk)} hole(s); kept {int(keep.sum())} of {int((m > 127).sum())} white px')
    return p


def _all_links(cfg):
    return [(other, sid) for sid, c in cfg.items() for other in c.get('link', {})]


def main(argv, game=gamepaths.DEFAULT):
    global GAME; GAME = game
    steps = {'mask': 'mask', 'painter': 'painter', 'fg': 'fg', 'link': 'link', 'trace': 'trace'}
    if len(argv) < 2 or argv[1] not in list(steps) + ['list']:
        print('usage: python3 tools/scene_tool.py [--game <id>] mask|painter [--fg]|fg|trace <scene>|all  |  link <a> <b>|all  |  list'); return 2
    cfg = load_config(gamepaths.config(game, 'scene_tool.json'))
    if argv[1] == 'list':
        for sid, c in cfg.items(): print(f"{sid:28} {', '.join(k for k in c if not k.startswith('_'))}")
        return 0
    if argv[1] == 'link':
        pairs = _all_links(cfg) if argv[2:] == ['all'] else [tuple(argv[2:4])]
        if not all(len(p) == 2 for p in pairs): print('usage: python3 tools/scene_tool.py link <a> <b>|all'); return 2
        for a, b in pairs: link(a, b, cfg)
        return 0
    fgp = '--fg' in argv
    args = [a for a in argv[2:] if a != '--fg']
    key = 'fgpainter' if (argv[1] == 'painter' and fgp) else argv[1]
    ids = [s for s in cfg if key in cfg[s]] if args == ['all'] else args
    for sid in ids:
        if sid not in cfg or key not in cfg[sid]: print(f'{sid}: no {key} settings in {os.path.relpath(gamepaths.config(game, "scene_tool.json"), ROOT)}'); return 1
        if argv[1] == 'mask': mask(sid, cfg)
        elif argv[1] == 'trace': trace(sid, cfg)
        elif argv[1] == 'painter': painter(sid, cfg, fg=fgp)
        else: fg(sid, cfg)
    return 0


if __name__ == '__main__':
    game = gamepaths.pop_game(sys.argv)
    os.chdir(gamepaths.game_dir(game))
    sys.exit(main(sys.argv, game))
