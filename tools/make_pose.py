import os
# Slice an app-made battle pose sheet (Job 11, battle v2): 3 x 2 figures on magenta, every figure facing LEFT
# (ready, wind-up, cut / hurt, guard, down), into assets/game/pose_<name>.png: 3 x 2 cells of 200 x 120 art px (x Q).
# usage: python3 tools/make_pose.py [--game <id>] <name> <ready-pose height in art px> [q2]      e.g.  python3 tools/make_pose.py hayato_22 88 q2
# Figures are found as connected shapes (a sword may reach past the next figure's column, so no fixed grid); one scale for
# the whole sheet, set by the READY figure's head-to-feet height; each figure's feet sit on its cell's bottom edge with the
# middle of its feet at 60% of the cell width (POSE_AX in 07b_battle_draw.js: more room in front, to the left, for the blade).
import sys, re, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import gamepaths; GAME = gamepaths.use_game()   # job fw-F5a: `--game <id>` reads that game's assets/raw and writes its assets/game (default: the current game)
name, FIG_H = sys.argv[1], float(sys.argv[2])
Q = next((int(a[1:]) for a in sys.argv[3:] if re.fullmatch(r'q[1-4]', a)), 1)
SRC = f'assets/raw/pose_{name}.png'
if not os.path.exists(SRC): SRC = f'assets/raw/pose_{name}.webp'
OUT = f'assets/game/pose_{name}.png'
CW, CH, AX = 200 * Q, 120 * Q, 0.6
im = np.array(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
d = np.abs(im - np.array([250, 0, 250], np.float32)).sum(2)
mag = (im[..., 0] > 140) & (im[..., 2] > 140) & (im[..., 1] < 130) & (np.abs(im[..., 0] - im[..., 2]) < 60)
fg = (d > 110) & ~mag
fg = ndi.binary_opening(fg, iterations=1)
def runs(v, gap):
    idx = np.where(v)[0]; out = []; s = p = None
    for i in idx:
        if s is None: s = p = i
        elif i - p > gap: out.append((s, p + 1)); s = p = i
        else: p = i
    if s is not None: out.append((s, p + 1))
    return out
rows = [r for r in runs(fg.sum(1) > 2, 14) if r[1] - r[0] > 60]
assert len(rows) == 2, ('row bands', rows)
figs = []
for (y0, y1) in rows:
    band = fg[y0:y1]
    lab, n = ndi.label(ndi.binary_dilation(band, iterations=3))
    sizes = ndi.sum(band, lab, range(1, n + 1))
    keep = [1 + i for i in np.argsort(sizes)[::-1][:3]]
    parts = []
    for k in keep:
        m = (lab == k) & band; ys, xs = np.where(m)
        parts.append((xs.min(), m, y0))
    parts.sort(key=lambda t: t[0])
    assert len(parts) == 3, ('figures in band', (y0, y1), len(parts))
    figs += [(m, oy) for _, m, oy in parts]
def bbox(m): ys, xs = np.where(m); return ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
# scale from the ready figure: first row wider than a blade, down to the feet
m0, oy0 = figs[0]; t, b, l, r = bbox(m0)
wid = m0.sum(1); top = int(np.argmax(wid > 25))
scale = FIG_H * Q / float(b - top)
print('rows', rows, 'ready body px', b - top, 'scale', round(scale, 4))
sheet = Image.new('RGBA', (CW * 3, CH * 2), (0, 0, 0, 0))
for i, (m, oy) in enumerate(figs):
    t, b, l, r = bbox(m)
    s = im[oy + t:oy + b, l:r].copy(); a = (m[t:b, l:r]).astype(np.uint8) * 255
    spill = (s[..., 0] > 120) & (s[..., 2] > 120) & (s[..., 1] < s[..., 0] * 0.55) & (np.abs(s[..., 0] - s[..., 2]) < 70)
    a[spill & (s[..., 1] < 90)] = 0
    # the stance: the median of the shape's pixels in its lowest quarter (legs and feet; a thin blade on the ground counts little)
    hh = b - t; ys_, xs = np.where(a[int(hh * 0.75):] > 0)
    foot_x = float(np.median(xs)) if len(xs) else (r - l) / 2
    pm = np.dstack([s, a]).astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    tw, th = max(1, round(pm.shape[1] * scale)), max(1, round(pm.shape[0] * scale))
    tt = Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)
    ta = np.array(tt).astype(np.float32); al = ta[..., 3:4]
    rgb = np.where(al > 0, ta[..., :3] * 255 / np.maximum(al, 1), 0).clip(0, 255)
    res = Image.fromarray(np.dstack([rgb, np.where(al >= 110, 255, 0)]).astype(np.uint8), 'RGBA')
    px, py = round(CW * AX - foot_x * scale), CH - th
    if px < 0 or px + tw > CW or py < 0: print(f'  WARNING figure {i + 1} overflows its cell: x {px}..{px + tw} of {CW}, top {py}')
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cell.paste(res, (px, py), res)
    sheet.paste(cell, ((i % 3) * CW, (i // 3) * CH))
    print(f'  figure {i + 1}: {r - l}x{hh} src px -> {tw}x{th}, feet at {foot_x:.0f}')
sheet.save(OUT, optimize=True)
print('wrote', OUT, sheet.size)
