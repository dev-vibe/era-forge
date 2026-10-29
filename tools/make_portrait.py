# Portrait from the app (assets/raw/portrait_<name>.png, transparent) -> game-ready square canvas.
# usage: python3 tools/make_portrait.py [--game <id>] <name> [size=144]      e.g.  python3 tools/make_portrait.py hayato_22
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import gamepaths; GAME = gamepaths.use_game()   # job fw-F5a: `--game <id>` reads that game's assets/raw and writes its assets/game (default: the current game)
name = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 144
import os
_src = f'assets/raw/portrait_{name}.png'
if not os.path.exists(_src): _src = f'assets/raw/portrait_{name}.webp'   # vault copies are lossless webp
a = np.array(Image.open(_src).convert('RGBA')).astype(np.float32)
al = a[..., 3]
al = np.where(al >= 240, 255, al); al = np.where(al < 24, 0, al)           # app alpha 250-254 -> opaque, haze -> gone
a[..., 3] = al
# premultiplied area downscale to N x N, then hard alpha
pm = a.copy(); pm[..., :3] *= pm[..., 3:4] / 255
t = Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((N, N), Image.BOX)
ta = np.array(t).astype(np.float32); al2 = ta[..., 3:4]
rgb = np.where(al2 > 0, ta[..., :3] * 255 / np.maximum(al2, 1), 0).clip(0, 255)
A = np.where(al2[..., 0] >= 120, 255, 0).astype(np.uint8)
# edge despill: saturated red/pink specks on the silhouette edge become the dark outline colour
m = A > 0
edge = m & ~ndi.binary_erosion(m, iterations=2)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
red = edge & (r > 140) & (g < 0.55 * r) & (b < 0.7 * r) & ~((r > 200) & (g > 120))   # leaves orange skin/cloth alone
rgb[red] = (30, 20, 36)
out = np.dstack([rgb, A]).astype(np.uint8)
out[A == 0, :3] = 0
Image.fromarray(out, 'RGBA').save(f'assets/game/portrait_{name}.png')
print('saved', f'assets/game/portrait_{name}.png', N, 'despilled', int(red.sum()))
