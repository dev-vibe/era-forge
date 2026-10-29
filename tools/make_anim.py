import os, sys, re, json
# Slice an app-made animation strip (Job 17): N figures on magenta, every figure facing LEFT, read row by row, left to
# right, into assets/game/anim_<name>.png: ONE row of N cells, each CW x CH art px (x Q).
#
#   python3 tools/make_anim.py <name> <pose cast> <match cell> [q2] [cell=WxH]
#   e.g. python3 tools/make_anim.py hayato_22_strike hayato_22 ready q2
#
# MAP-SCALE strips (Job 18: the dance, the field and story actions) are matched to a cell of a WALKING or FIELD sheet instead of a
# battle pose cell: ref=<sheet in assets/game>:<cellW>x<cellH>:<columns>:<col>:<row> (cell size in art px, e.g. 84x100 for a char_ sheet),
# and <pose cast> / <match cell> are then ignored (use - -). Use cell=WxH and right=<art px from the feet to the cell's right edge>
# (the dance: cell=120x130 right=60, feet on the bottom edge in the middle; the field poses: cell=240x150 right=96).
#   e.g. python3 tools/make_anim.py dance_oyone_19_step - - q2 cell=120x130 right=60 ref=char_oyone_19.png:84x100:3:0:2
#
# Same rules as make_pose.py (connected shapes, no trusted grid; one scale for the whole strip; feet on the cell's bottom
# edge; the middle of the feet at a fixed distance from the cell's RIGHT edge, the same distance as in the pose cells, so a
# clip frame lands exactly where the pose cell it replaces stood). The scale is set by matching frame 1's body height
# (from the first row wider than a blade down to the feet) to the same measure of <match cell> in the approved,
# already-sliced pose sheet assets/game/pose_<cast>.png: 'ready' for a strip that starts in the READY stance, 'down' for one
# that starts on one knee. The processor only keys, scales uniformly and places; it never redraws anything. Magenta fringe
# on the outline (the near-magenta the app paints instead of flat #FF00FF) is neutralised on edge pixels only.
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

name, cast, match = sys.argv[1], sys.argv[2], sys.argv[3]
Q = next((int(a[1:]) for a in sys.argv[4:] if re.fullmatch(r'q[1-4]', a)), 1)
cell = next((a[5:] for a in sys.argv[4:] if a.startswith('cell=')), '240x150')
CWa, CHa = map(int, cell.split('x'))
POSE_CW, POSE_CH, POSE_AX = 200, 120, 0.6
# art px from the feet to the cell's right edge: 80 as in the pose cells, more for a big man who falls back (right=<px>);
# a strip with a non-default cell or right margin must say so in its CLIPS entry (cell / right) so the engine anchors it
RIGHT = next((float(a[6:]) for a in sys.argv[4:] if a.startswith('right=')), POSE_CW * (1 - POSE_AX))
CW, CH = CWa * Q, CHa * Q
SRC = next(p for p in (f'assets/raw/anim_{name}.png', f'assets/raw/anim_{name}.webp') if os.path.exists(p))
OUT = f'assets/game/anim_{name}.png'
POSE_I = {'ready': 0, 'wind': 1, 'cut': 2, 'hurt': 3, 'guard': 4, 'down': 5}

def body_h(alpha, minw):
    """head-to-feet height: from the first row wider than minw (a blade is thinner) to the lowest pixel"""
    rows = np.where((alpha > 0).sum(1) > minw)[0]; ys = np.where((alpha > 0).any(1))[0]
    return ys.max() + 1 - rows.min()

# the target: the matching cell of the approved pose sheet (or, for a map-scale strip, of a walking / field sheet), in final game pixels
REF = next((a[4:] for a in sys.argv[4:] if a.startswith('ref=')), None)
if REF:
    rf, rc, rcols, rcol, rrow = REF.split(':'); rw, rh = map(int, rc.split('x')); rcols, rcol, rrow = int(rcols), int(rcol), int(rrow)
    rim = np.array(Image.open(f'assets/game/{rf}').convert('RGBA')); pq = round(rim.shape[1] / (rw * rcols))
    pc = rim[rrow * rh * pq:(rrow + 1) * rh * pq, rcol * rw * pq:(rcol + 1) * rw * pq, 3]
    target = body_h(pc, 6 * pq) * Q / pq
else:
    pose = np.array(Image.open(f'assets/game/pose_{cast}.png').convert('RGBA'))
    pq = round(pose.shape[1] / (POSE_CW * 3)); i = POSE_I[match]
    pc = pose[(i // 3) * POSE_CH * pq:(i // 3 + 1) * POSE_CH * pq, (i % 3) * POSE_CW * pq:(i % 3 + 1) * POSE_CW * pq, 3]
    target = body_h(pc, 6 * pq) * Q / pq   # 6 art px ~ the 25 source px blade threshold below

im = np.array(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
d = np.abs(im - np.array([250, 0, 250], np.float32)).sum(2)
mag = (im[..., 0] > 140) & (im[..., 2] > 140) & (im[..., 1] < 130) & (np.abs(im[..., 0] - im[..., 2]) < 60)
fg = ndi.binary_opening((d > 110) & ~mag, iterations=1)

# figures: connected shapes (dilated a little so a sword joins its man), largest first, then read in rows
lab, n = ndi.label(ndi.binary_dilation(fg, iterations=3))
sizes = ndi.sum(fg, lab, range(1, n + 1))
big = [1 + k for k in range(n) if sizes[k] > sizes.max() * 0.15]
figs = []
for k in big:
    m = (lab == k) & fg; ys, xs = np.where(m)
    figs.append(dict(m=m, t=ys.min(), b=ys.max() + 1, l=xs.min(), r=xs.max() + 1, cy=(ys.min() + ys.max()) / 2))
# n=<count>: two drawings the app let touch (a blade tip on the next figure's boot) come out as one shape. Split the widest
# shape with a straight vertical cut at its thinnest column in the middle of the shape: a crop only, nothing is redrawn.
want = next((int(a[2:]) for a in sys.argv[4:] if a.startswith('n=')), 0)
def box(m):
    ys, xs = np.where(m); return dict(m=m, t=ys.min(), b=ys.max() + 1, l=xs.min(), r=xs.max() + 1, cy=(ys.min() + ys.max()) / 2)
while want and len(figs) < want:
    k = max(range(len(figs)), key=lambda i: figs[i]['r'] - figs[i]['l']); f = figs.pop(k)
    cols = f['m'][:, f['l']:f['r']].sum(0); w = len(cols); lo, hi = int(w * 0.3), int(w * 0.7)
    c = f['l'] + lo + int(np.argmin(cols[lo:hi]))
    left = f['m'].copy(); left[:, c:] = False; right = f['m'].copy(); right[:, :c] = False
    figs += [box(left), box(right)]
    print(f'  split a joined shape at x {c} ({int(cols[c - f["l"]])} px in that column)')
# rows: figures whose vertical extents overlap belong to the same row band
figs.sort(key=lambda f: f['cy'])
bands = []
for f in figs:
    if bands and f['t'] < max(g['b'] for g in bands[-1]) - 0.25 * (f['b'] - f['t']): bands[-1].append(f)
    else: bands.append([f])
order = [f for band in bands for f in sorted(band, key=lambda f: f['l'])]
print(f'{SRC}: {W}x{H}, {len(order)} figures in rows of', [len(b) for b in bands])

f0 = order[0]; a0 = f0['m'][f0['t']:f0['b'], f0['l']:f0['r']].astype(np.uint8)
scale = target / body_h(a0, 25)
print(f'match {match}: target body {target:.1f} px (q{Q}), frame 1 body {body_h(a0, 25)} src px, scale {scale:.4f}')

def despill(rgb, a):
    """neutralise magenta on the outline only: pixels within 2 px of transparency whose red and blue both exceed green"""
    edge = (a > 0) & ndi.binary_dilation(a == 0, iterations=2)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sp = np.minimum(r, b) - g
    fix = edge & (sp > 30) & (np.minimum(r, b) > 90)
    k = np.where(fix, sp * 0.85, 0)
    out = rgb.copy(); out[..., 0] -= k; out[..., 2] -= k
    return out.clip(0, 255), int(fix.sum())

strip = Image.new('RGBA', (CW * len(order), CH), (0, 0, 0, 0))
meta = {'name': f'anim_{name}', 'cast': cast, 'match': match, 'ref': REF, 'q': Q, 'cell': [CWa, CHa], 'right': RIGHT,
        'ax': round(1 - RIGHT / CWa, 4), 'frames': len(order), 'scale': round(scale, 5), 'overflow': []}
for i, f in enumerate(order):
    t, b, l, r = f['t'], f['b'], f['l'], f['r']
    s = im[t:b, l:r].copy(); a = f['m'][t:b, l:r].astype(np.uint8) * 255
    spill = (s[..., 0] > 120) & (s[..., 2] > 120) & (s[..., 1] < s[..., 0] * 0.55) & (np.abs(s[..., 0] - s[..., 2]) < 70)
    a[spill & (s[..., 1] < 90)] = 0
    hh = b - t; ys_, xs = np.where(a[int(hh * 0.75):] > 0)
    foot_x = float(np.median(xs)) if len(xs) else (r - l) / 2
    pm = np.dstack([s, a]).astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    tw, th = max(1, round(pm.shape[1] * scale)), max(1, round(pm.shape[0] * scale))
    ta = np.array(Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)).astype(np.float32)
    al = ta[..., 3:4]
    rgb = np.where(al > 0, ta[..., :3] * 255 / np.maximum(al, 1), 0).clip(0, 255)
    alpha = np.where(al[..., 0] >= 110, 255, 0).astype(np.uint8)
    rgb, nfix = despill(rgb, alpha)
    res = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')
    px, py = round(CW - RIGHT * Q - foot_x * scale), CH - th
    if px < 0 or px + tw > CW or py < 0:
        meta['overflow'].append(i + 1)
        print(f'  WARNING frame {i + 1} overflows its cell: x {px}..{px + tw} of {CW}, top {py}')
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); c.paste(res, (px, py), res)
    strip.paste(c, (i * CW, 0))
    print(f'  frame {i + 1}: {r - l}x{hh} src px -> {tw}x{th}, feet at {foot_x:.0f}, edge pixels despilled {nfix}')
strip.save(OUT, optimize=True)
json.dump(meta, open(f'assets/game/anim_{name}.json', 'w'), indent=1)
print('wrote', OUT, strip.size)
