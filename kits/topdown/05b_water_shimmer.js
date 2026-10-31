// 12d-water: sparse surface glints over the unchanged painting (sparkle only).
// The entire water pass shares its far plate's rectangle, before near scenery/actors.
// Config (all optional; the defaults are the first approved look: an all-lake far plate):
//   top       fraction of the plate height kept clear (islands, horizon) and faded in below it (default .15)
//   mask      asset name of a painted water area (green or white on black, any size): glints only
//             where it is set. With a mask, nothing is drawn until the mask image has loaded.
//   match     'lake' (default: pale and medium blue/cyan, green >= 115) or 'cool' (any pixel bluer than it is red: dark water too)
//   density   share of the qualifying pixels that carry a glint (default .045)
//   strength  alpha multiplier (default 1; lower for a subtler sparkle)
//   sun       x of the sunlit column as a fraction of the width, or null for none (default .71)
//   enabled   false turns it off
const WATER_SHIMMER = new WeakMap();
function waterShimmerPlate(im, config) {
  let q = WATER_SHIMMER.get(im);
  if (!q) {
    const maskIm = config.mask ? assetImg(config.mask) : null;
    if (config.mask && !(maskIm && maskIm.width)) return null;   // wait for the painted area
    const w = Math.min(1024, im.width), h = Math.round(im.height * w / im.width);
    const [surface, sg] = mk(w, h); sg.drawImage(im, 0, 0, w, h);
    const src = sg.getImageData(0, 0, w, h).data, glints = [];
    let mask = null;
    let clip = null;   // the painted area as alpha: glints are cut to it, so none spills past the water's edge
    if (maskIm) {
      const [mc, mg] = mk(w, h); mg.imageSmoothingEnabled = false; mg.drawImage(maskIm, 0, 0, w, h);
      const md = mg.getImageData(0, 0, w, h); mask = md.data.slice();
      for (let i = 0; i < md.data.length; i += 4) { const on = md.data[i+3] >= 128 && md.data[i+1] >= 128; md.data[i] = md.data[i+1] = md.data[i+2] = 255; md.data[i+3] = on ? 255 : 0; }
      mg.putImageData(md, 0, 0); clip = mc;
    }
    const top = config.top == null ? .15 : config.top, cool = config.match === 'cool';
    const keep = 1 - (config.density == null ? .045 : config.density), sunX = config.sun === undefined ? .71 : config.sun;
    // This plate contains only open lake below this line; every island is above it.
    for (let y = Math.ceil(h * top) + 4; y < h - 2; y++) for (let x = 6; x < w - 6; x++) {
      if (hash(x, y, 9206) <= keep) continue;
      const i = (y * w + x) * 4, red = src[i], green = src[i+1], blue = src[i+2];
      if (mask && (mask[i+3] < 128 || mask[i+1] < 128)) continue;
      if (src[i+3] < 250 || blue < red) continue;
      // Include the medium-blue water too, spreading glints beyond the palest ripple marks ('cool': dark blue water as well).
      if (!cool && (green < red || green < 115)) continue;
      const depth = (y / h - top) / (1 - top), edge = Math.min(1, (y / h - top) * 35);
      const sun = sunX == null ? 0 : Math.exp(-Math.pow((x / w - sunX) / (.055 + depth * .24), 2));
      const p = x*.119 + y*.73, r = -x*.071 + y*.49;
      glints.push({ x, y, depth, edge, sun, sp: Math.sin(p), cp: Math.cos(p), sq: Math.sin(r), cq: Math.cos(r), phase: hash(x, y, 9207)*Math.PI*2 });
    }
    const [c, g] = mk(w, h);
    q = { c, g, glints, clip, top: Math.ceil(h*top), tick: -1 }; WATER_SHIMMER.set(im, q);
  }
  const tick = Math.floor(frame / 3); // 20 Hz, cached between lighting frames.
  if (tick !== q.tick) {
    const t = tick / 20, g = q.g, w = q.c.width, h = q.c.height, strength = config.strength == null ? 1 : config.strength;
    g.clearRect(0, 0, w, h);
    // Only the light facets change. Never redraw or displace the source painting.
    const a = Math.cos(t*2.7), b = Math.sin(t*2.7), c = Math.cos(t*2.13), d = Math.sin(t*2.13);
    for (const s of q.glints) {
      const wave = .5 + .29*(s.sp*a-s.cp*b) + .21*(s.sq*c+s.cq*d);
      const k = clamp((wave - .72) / .25, 0, 1), flash = k*k*(3-2*k);
      if (flash < .03) continue;
      const width = Math.max(1, Math.round((2.5 + s.depth*5) * (.5 + .5*flash)));
      const x = Math.round(s.x - width/2);
      g.globalAlpha = strength*s.edge*(.65+.35*s.sun)*flash;
      g.fillStyle = '#f7fff2'; g.fillRect(x, s.y, width, 1);
      // A few peak glints catch a tiny vertical pin of light, as in the painted sun path.
      if (flash>.86 && s.phase>5.8) g.fillRect(Math.round(s.x),s.y-1,1,3);
    }
    g.globalAlpha = 1;
    if (q.clip) { g.globalCompositeOperation = 'destination-in'; g.drawImage(q.clip, 0, 0); g.globalCompositeOperation = 'source-over'; }
    q.tick = tick;
  }
  return q.c;
}
function drawWaterShimmer(im, config, x, y, w, h) {
  if (!config || config.enabled === false || !im) return;
  const plate = waterShimmerPlate(im, config);
  if (!plate) return;
  L.save(); L.imageSmoothingEnabled = false;
  L.drawImage(plate, x, y, w, h);
  L.restore();
}
