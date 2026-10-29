// 12d-water: sparse surface glints over the unchanged painting (sparkle only).
// The entire water pass shares its far plate's rectangle, before near scenery/actors.
const WATER_SHIMMER = new WeakMap();
function waterShimmerPlate(im, config) {
  let q = WATER_SHIMMER.get(im);
  if (!q) {
    const w = Math.min(1024, im.width), h = Math.round(im.height * w / im.width);
    const [surface, sg] = mk(w, h); sg.drawImage(im, 0, 0, w, h);
    const src = sg.getImageData(0, 0, w, h).data, glints = [];
    const top = config.top == null ? .15 : config.top;
    // This plate contains only open lake below this line; every island is above it.
    for (let y = Math.ceil(h * top) + 4; y < h - 2; y++) for (let x = 6; x < w - 6; x++) {
      if (hash(x, y, 9206) <= .955) continue;
      const i = (y * w + x) * 4, red = src[i], green = src[i+1], blue = src[i+2];
      // Include the medium-blue water too, spreading glints beyond the palest ripple marks.
      if (src[i+3] < 250 || blue < red || green < red || green < 115) continue;
      const depth = (y / h - top) / (1 - top), edge = Math.min(1, (y / h - top) * 35);
      const sun = Math.exp(-Math.pow((x / w - .71) / (.055 + depth * .24), 2));
      const p = x*.119 + y*.73, r = -x*.071 + y*.49;
      glints.push({ x, y, depth, edge, sun, sp: Math.sin(p), cp: Math.cos(p), sq: Math.sin(r), cq: Math.cos(r), phase: hash(x, y, 9207)*Math.PI*2 });
    }
    const [c, g] = mk(w, h);
    q = { c, g, glints, top: Math.ceil(h*top), tick: -1 }; WATER_SHIMMER.set(im, q);
  }
  const tick = Math.floor(frame / 3); // 20 Hz, cached between lighting frames.
  if (tick !== q.tick) {
    const t = tick / 20, g = q.g, w = q.c.width, h = q.c.height;
    g.clearRect(0, 0, w, h);
    // Only the light facets change. Never redraw or displace the source painting.
    const a = Math.cos(t*2.7), b = Math.sin(t*2.7), c = Math.cos(t*2.13), d = Math.sin(t*2.13);
    for (const s of q.glints) {
      const wave = .5 + .29*(s.sp*a-s.cp*b) + .21*(s.sq*c+s.cq*d);
      const k = clamp((wave - .72) / .25, 0, 1), flash = k*k*(3-2*k);
      if (flash < .03) continue;
      const width = Math.max(1, Math.round((2.5 + s.depth*5) * (.5 + .5*flash)));
      const x = Math.round(s.x - width/2);
      g.globalAlpha = s.edge*(.65+.35*s.sun)*flash;
      g.fillStyle = '#f7fff2'; g.fillRect(x, s.y, width, 1);
      // A few peak glints catch a tiny vertical pin of light, as in the painted sun path.
      if (flash>.86 && s.phase>5.8) g.fillRect(Math.round(s.x),s.y-1,1,3);
    }
    g.globalAlpha = 1; q.tick = tick;
  }
  return q.c;
}
function drawWaterShimmer(im, config, x, y, w, h) {
  if (!config || config.enabled === false) return;
  L.save(); L.imageSmoothingEnabled = false;
  L.drawImage(waterShimmerPlate(im, config), x, y, w, h);
  L.restore();
}
