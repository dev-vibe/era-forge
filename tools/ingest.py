# Ingest a generated PNG into a game-ready sprite.
# usage: python3 tools/ingest.py raw.png out.png native_w density [--pixel]
#   native_w : width in native (640x360) pixels the object should span
#   density  : 1 = native pixel art, 2/3 = hi-density art (drawn at native_w*density px)
import sys, numpy as np
from PIL import Image, ImageFilter

def load_keyed(path):
    im = Image.open(path).convert('RGBA'); a = np.array(im).astype(np.float32)
    al = a[..., 3]
    if (al == 0).mean() < 0.02:  # no transparency: key out flat magenta / corner colour
        key = a[0, 0, :3]; d = np.abs(a[..., :3] - key).sum(2); al = np.clip((d - 30) * 4, 0, 255)
    al = np.where(al >= 240, 255, al)            # GPT-Image alpha 250-254 -> fully opaque
    al = np.where(al < 24, 0, al)                 # faint haze -> gone
    a[..., 3] = al
    ys, xs = np.where(al > 128)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(a.astype(np.uint8), 'RGBA'), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

def to_native_pixel(im, w, h, colours=192):
    # area-average in premultiplied space, then hard alpha, light unsharp and a shared palette (no dither)
    s = im.resize((w, h), Image.BOX)
    s = s.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    a = np.array(s); al = a[..., 3]
    rgb = Image.fromarray(a[..., :3]).quantize(colours, method=Image.Quantize.FASTOCTREE, kmeans=3, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(rgb), np.where(al >= 110, 255, 0).astype(np.uint8)])
    # dark tinted outline where the silhouette meets transparency
    m = out[..., 3] > 0; edge = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    out[edge, :3] = (out[edge, :3] * 0.45 + np.array([14, 10, 22]) * 0.55).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def to_hidensity(im, w, h):
    s = im.resize((w, h), Image.LANCZOS)          # Pillow premultiplies RGBA internally
    return s.filter(ImageFilter.UnsharpMask(radius=0.8, percent=45, threshold=2))

if __name__ == '__main__':
    raw, out, nw, k = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    im, box = load_keyed(raw)
    nh = round(im.height * nw / im.width)
    res = to_native_pixel(im, nw, nh) if k == 1 else to_hidensity(im, nw * k, nh * k)
    res.save(out); print(out, res.size, 'native', (nw, nh), 'crop', box)
