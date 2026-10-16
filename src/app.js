(function () {
  'use strict';
  const C = SpectreCore;
  // Filled in by scripts/build.js: the version from package.json, a hash of the sources, and the build time.
  const BUILD = { version: '__SPECTRE_VERSION__', hash: '__SPECTRE_BUILD__', date: '__SPECTRE_DATE__' };
  try { console.info(`Spectre Lab ${BUILD.version} (build ${BUILD.hash}, ${BUILD.date})`); } catch (_) {}
  const $ = id => document.getElementById(id);
  const MAXD = 5;
  const TYPES = C.TYPES;
  const TIDX = {}; TYPES.forEach((t, i) => TIDX[t] = i);
  const ART = { D: 'a', G: 'a', J: 'a', P: 'a', Y: 'a', F: 'an', L: 'an', S: 'an', X: 'an' };
  const ORD = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  const FONT_D = '"Spectral", "Iowan Old Style", Georgia, serif';
  const FONT_M = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const fmt = n => n.toLocaleString('en-US');
  const minus = n => (n < 0 ? '−' + (-n) : String(n));

  function mulberry(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // Seeds: a hexagon type that contains itself at a fixed child number.
  const SEEDS = [
    { id: 'D5', label: 'D inside D, child 5', short: 'D⊂D·5', make: () => C.fixedChain('D', 1) },
    { id: 'G2', label: 'G inside G, child 2', short: 'G⊂G·2', make: () => C.fixedChain('G', 7) },
    { id: 'S3', label: 'S inside S, child 3', short: 'S⊂S·3', make: () => C.fixedChain('S', 4) },
    { id: 'F0', label: 'F inside F, child 0', short: 'F⊂F·0', make: () => C.fixedChain('F', 6) },
    { id: 'F6', label: 'F inside F, child 6', short: 'F⊂F·6', make: () => C.fixedChain('F', 3) },
    { id: 'Y1', label: 'Y inside Y, child 1', short: 'Y⊂Y·1', make: () => C.fixedChain('Y', 5) },
    { id: 'Y4', label: 'Y inside Y, child 4', short: 'Y⊂Y·4', make: () => C.fixedChain('Y', 0) },
    { id: 'Y7', label: 'Y inside Y, child 7', short: 'Y⊂Y·7', make: () => C.fixedChain('Y', 2) },
    { id: 'R', label: 'Random ancestry', short: 'random', make: () => C.randomChain(mulberry(S.rseed)) }
  ];

  const S = { depth: 4, seed: 'D5', rseed: 2718, colour: 'type', torder: 1, outline: 2,
              letters: true, curved: false, edgeNums: true, sel: -1 };
  const V = { s: 10, ox: 0, oy: 0 };
  let P = null, chain = null, cache = {};
  let hoverNode = -1, pinNode = -1, hoverEdge = -1, cameEdge = -1, lastStep = null;
  let PAL = {}, DPR = 1, W = 0, H = 0, raf = 0;
  const cv = $('cv'), ctx = cv.getContext('2d'), stage = cv.parentElement;

  // ---------- palette ----------
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    PAL = {
      type: TYPES.map(t => g('--t-' + t)).concat([g('--t-G1')]),
      four: [0, 1, 2, 3].map(i => g('--c4-' + i)),
      orient: [0, 1, 2, 3, 4, 5].map(i => g('--o-' + i)).concat([g('--o-odd')]),
      plain: [g('--plain')],
      stage: g('--stage'), grout: g('--grout'), sup: g('--super'), accent: g('--accent'),
      halo: g('--halo'), ink: g('--ink')
    };
  }
  const palette = () => S.colour === 'type' ? PAL.type : S.colour === 'four' ? PAL.four : S.colour === 'orient' ? PAL.orient : PAL.plain;

  // ---------- patch ----------
  let CORE = [0, 0];
  function makeChain() {
    chain = SEEDS.find(s => s.id === S.seed).make();
    const core = C.build(chain, 1); let cx = 0, cy = 0;
    for (let i = 0; i < core.N; i++) { cx += core.cen[i * 2]; cy += core.cen[i * 2 + 1]; }
    CORE = [cx / core.N, cy / core.N];
  }
  function build() {
    P = C.build(chain, S.depth);
    cache = {}; hoverNode = -1; pinNode = -1; hoverEdge = -1;
    const byOrder = [];
    for (let v = 0; v < P.nodes.type.length; v++) { const o = P.nodes.order[v]; (byOrder[o] || (byOrder[o] = [])).push(v); }
    P.byOrder = byOrder;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < P.N; i++) {
      const b = i * 4;
      if (P.bbox[b] < x0) x0 = P.bbox[b]; if (P.bbox[b + 1] < y0) y0 = P.bbox[b + 1];
      if (P.bbox[b + 2] > x1) x1 = P.bbox[b + 2]; if (P.bbox[b + 3] > y1) y1 = P.bbox[b + 3];
    }
    P.box = [x0, y0, x1, y1];
  }
  const tileKey = i => { const T = P.tiles.T[i]; return T.t.join(',') + '|' + T.k + '|' + (T.f ? 1 : 0); };
  function findKey(key) { for (let i = 0; i < P.N; i++) if (tileKey(i) === key) return i; return -1; }

  function colourIndex() {
    const key = 'ci|' + S.colour + '|' + S.torder;
    if (cache[key]) return cache[key];
    const N = P.N, out = new Uint8Array(N);
    if (S.colour === 'type') {
      const k = Math.min(S.torder, P.n + 1), a = P.anc[k];
      for (let i = 0; i < N; i++) out[i] = (k === 1 && P.tiles.sub[i] === 1) ? 9 : TIDX[P.nodes.type[a[i]]];
    } else if (S.colour === 'four') {
      out.set(fourCol());
    } else if (S.colour === 'orient') {
      for (let i = 0; i < N; i++) out[i] = P.tk[i] % 2 ? 6 : P.tk[i] / 2;
    }
    return cache[key] = out;
  }
  function fourCol() { return cache.four || (cache.four = C.fourColour(P)); }

  // ---------- geometry → paths (world coordinates) ----------
  const BULGE = 0.27;
  function ctrl(i, e) {
    const b = i * 28, xy = P.xy, c = (e + 1) % 14;
    const ax = xy[b + e * 2], ay = xy[b + e * 2 + 1], bx = xy[b + c * 2], by = xy[b + c * 2 + 1];
    // outline runs anticlockwise, so (dy, -dx) points out of the tile
    const s = (C.tEdge(e) % 2 === 0 ? BULGE : -BULGE) * (P.tf[i] ? -1 : 1);
    return [(ax + bx) / 2 + (by - ay) * s, (ay + by) / 2 - (bx - ax) * s];
  }
  function traceTile(path, i) {
    const b = i * 28, xy = P.xy;
    path.moveTo(xy[b], xy[b + 1]);
    for (let e = 0; e < 14; e++) {
      const c = (e + 1) % 14, x = xy[b + c * 2], y = xy[b + c * 2 + 1];
      if (S.curved) { const q = ctrl(i, e); path.quadraticCurveTo(q[0], q[1], x, y); } else path.lineTo(x, y);
    }
    path.closePath();
  }
  function segment(path, i, e) {
    const b = i * 28, xy = P.xy, c = (e + 1) % 14;
    path.moveTo(xy[b + e * 2], xy[b + e * 2 + 1]);
    if (S.curved) { const q = ctrl(i, e); path.quadraticCurveTo(q[0], q[1], xy[b + c * 2], xy[b + c * 2 + 1]); }
    else path.lineTo(xy[b + c * 2], xy[b + c * 2 + 1]);
  }
  function fills() {
    const key = 'fill|' + S.colour + '|' + S.torder + '|' + S.curved;
    if (cache[key]) return cache[key];
    const ci = colourIndex(), paths = [];
    for (let i = 0; i < P.N; i++) { const c = ci[i]; traceTile(paths[c] || (paths[c] = new Path2D()), i); }
    return cache[key] = paths;
  }
  function edgesPath() {
    const key = 'edges|' + S.curved;
    if (cache[key]) return cache[key];
    const p = new Path2D();
    for (let i = 0; i < P.N; i++) for (let e = 0; e < 14; e++) { const j = P.nbT[i * 14 + e]; if (j < 0 || j > i) segment(p, i, e); }
    return cache[key] = p;
  }
  function outlinePath(k) {
    const key = 'out|' + k + '|' + S.curved;
    if (cache[key]) return cache[key];
    const p = new Path2D(), a = P.anc[k];
    for (let i = 0; i < P.N; i++) for (let e = 0; e < 14; e++) {
      const j = P.nbT[i * 14 + e];
      if (j < 0 || (j > i && a[i] !== a[j])) segment(p, i, e);
    }
    return cache[key] = p;
  }
  function nodePaths(v) {
    const key = 'node|' + v + '|' + S.curved;
    if (cache[key]) return cache[key];
    const s = P.nodes.start[v], t = P.nodes.end[v], fill = new Path2D(), edge = new Path2D();
    for (let i = s; i < t; i++) {
      traceTile(fill, i);
      for (let e = 0; e < 14; e++) { const j = P.nbT[i * 14 + e]; if (j < s || j >= t) segment(edge, i, e); }
    }
    return cache[key] = { fill, edge };
  }

  // ---------- drawing ----------
  function request() { if (!raf) raf = requestAnimationFrame(draw); }
  // Tiles only (flat colours or the tile design); used by the main view and the studio preview.
  function paintBase(g, view, w, h, dpr, textured, bg) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (bg === null) g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    else { g.fillStyle = bg || PAL.stage; g.fillRect(0, 0, g.canvas.width, g.canvas.height); }
    const k = view.s * dpr;
    g.setTransform(k, 0, 0, -k, view.ox * dpr, view.oy * dpr);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (textured) { paintTextured(g, view, w, h, dpr); return; }
    const pal = palette(), fp = fills(), grout = view.s > 3.2;
    for (let c = 0; c < fp.length; c++) {
      if (!fp[c]) continue;
      g.fillStyle = pal[c]; g.fill(fp[c]);
      if (!grout) { g.strokeStyle = pal[c]; g.lineWidth = 0.9 / view.s; g.stroke(fp[c]); }
    }
    if (grout) {
      g.strokeStyle = PAL.grout; g.globalAlpha = 0.9;
      g.lineWidth = Math.min(1.5, Math.max(0.7, view.s * 0.07)) / view.s; g.stroke(edgesPath());
      g.globalAlpha = 1;
    }
  }
  function draw() {
    raf = 0;
    if (!P || !W) return;
    paintBase(ctx, V, W, H, DPR, D.on);
    paintOutline(ctx, V, DPR);
    const hn = hoverNode >= 0 ? hoverNode : pinNode;
    if (hn >= 0) {
      const np = nodePaths(hn);
      ctx.fillStyle = PAL.accent; ctx.globalAlpha = 0.3; ctx.fill(np.fill); ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.halo; ctx.lineWidth = 5 / V.s; ctx.stroke(np.edge);
      ctx.strokeStyle = PAL.accent; ctx.lineWidth = 2.5 / V.s; ctx.stroke(np.edge);
    }
    if (S.sel >= 0) {
      const i = S.sel, sp = new Path2D(); traceTile(sp, i);
      if (hoverEdge >= 0) {
        const j = P.nbT[i * 14 + hoverEdge];
        if (j >= 0) { const np = new Path2D(); traceTile(np, j); ctx.fillStyle = PAL.accent; ctx.globalAlpha = 0.25; ctx.fill(np); ctx.globalAlpha = 1; }
      }
      ctx.strokeStyle = PAL.halo; ctx.lineWidth = 6.5 / V.s; ctx.stroke(sp);
      ctx.strokeStyle = PAL.accent; ctx.lineWidth = 3 / V.s; ctx.stroke(sp);
      if (hoverEdge >= 0) {
        const ep = new Path2D(); segment(ep, i, hoverEdge);
        ctx.strokeStyle = PAL.halo; ctx.lineWidth = 10 / V.s; ctx.stroke(ep);
        ctx.strokeStyle = PAL.accent; ctx.lineWidth = 5.5 / V.s; ctx.stroke(ep);
      }
      // anchor vertex (the exact coordinates shown in the panel)
      ctx.beginPath(); ctx.arc(P.xy[i * 28], P.xy[i * 28 + 1], 4.5 / V.s, 0, Math.PI * 2);
      ctx.fillStyle = PAL.accent; ctx.fill(); ctx.strokeStyle = PAL.halo; ctx.lineWidth = 2 / V.s; ctx.stroke();
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S.letters) drawLetters(ctx, V, W, H);
    if (S.sel >= 0 && S.edgeNums) drawEdgeNumbers();
  }
  // supertile outlines: thinner as the supertiles shrink on screen, so a zoomed-out patch is not buried in ink
  function paintOutline(g, view, dpr) {
    const k = view.s * dpr;
    g.setTransform(k, 0, 0, -k, view.ox * dpr, view.oy * dpr);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (S.outline <= 0) return;
    const px = Math.min(1.6 + 0.4 * S.outline, Math.max(0.45, view.s * 0.11 * Math.pow(1.7, S.outline - 1)));
    g.strokeStyle = PAL.sup; g.lineWidth = px / view.s; g.globalAlpha = px < 1 ? 0.5 + 0.5 * px : 1;
    g.stroke(outlinePath(S.outline)); g.globalAlpha = 1;
  }
  const sx = x => x * V.s + V.ox, sy = y => -y * V.s + V.oy;
  function letterOrder() { return S.outline > 0 ? S.outline : (S.colour === 'type' ? Math.min(S.torder, P.n + 1) : 1); }
  function drawLetters(g, view, w, h) {
    const list = P.byOrder[letterOrder()] || [];
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const v of list) {
      const b = v * 4, size = Math.min(P.nodeBox[b + 2] - P.nodeBox[b], P.nodeBox[b + 3] - P.nodeBox[b + 1]) * view.s;
      if (size < 24) continue;
      const x = P.nodeCen[v * 2] * view.s + view.ox, y = -P.nodeCen[v * 2 + 1] * view.s + view.oy;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      const fs = Math.max(11, Math.min(34, size * 0.2));
      g.font = `600 ${fs}px ${FONT_D}`;
      g.lineWidth = Math.max(3, fs * 0.2); g.strokeStyle = PAL.halo; g.strokeText(P.nodes.type[v], x, y);
      g.fillStyle = PAL.ink; g.fillText(P.nodes.type[v], x, y);
    }
  }
  function drawEdgeNumbers() {
    const i = S.sel, b = i * 28, xy = P.xy;
    const size = (P.bbox[i * 4 + 2] - P.bbox[i * 4]) * V.s;
    if (size < 130) return;
    const fs = Math.max(9.5, Math.min(15, V.s * 0.27));
    ctx.font = `500 ${fs}px ${FONT_M}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const sgn = P.tf[i] ? -1 : 1;
    for (let e = 0; e < 14; e++) {
      const c = (e + 1) % 14, ax = xy[b + e * 2], ay = xy[b + e * 2 + 1], bx = xy[b + c * 2], by = xy[b + c * 2 + 1];
      const mx = (ax + bx) / 2 - (by - ay) * 0.3 * sgn, my = (ay + by) / 2 + (bx - ax) * 0.3 * sgn;
      const t = String(C.tEdge(e)), x = sx(mx), y = sy(my);
      ctx.lineWidth = 3.5; ctx.strokeStyle = PAL.halo; ctx.strokeText(t, x, y);
      ctx.fillStyle = e === hoverEdge ? PAL.accent : PAL.ink; ctx.fillText(t, x, y);
    }
  }

  // ---------- tile design: one painted Spectre, repeated over the tiling ----------
  const BASE = C.PTS.map(p => C.toXY(p));                       // tile outline in its own frame
  const C0 = [0, 0]; BASE.forEach(p => { C0[0] += p[0] / 14; C0[1] += p[1] / 14; });
  let RH = 0; BASE.forEach(p => { RH = Math.max(RH, Math.hypot(p[0] - C0[0], p[1] - C0[1])); }); RH += 0.3;
  const RES = 140, TEXN = Math.round(2 * RH * RES);             // texture: a square around the tile, 140 px per edge length
  const BB = (() => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    BASE.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  })();
  const lx2px = x => (x - (C0[0] - RH)) * RES, ly2py = y => ((C0[1] + RH) - y) * RES;
  const COS = [], SIN = [];
  for (let k = 0; k < 12; k++) { COS[k] = Math.cos(k * Math.PI / 6); SIN[k] = Math.sin(k * Math.PI / 6); }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  const STARTER_PAR = 0;
  const D = { on: false, placement: 'turn', planeSize: 40, tint: 0, grout: 'fine', groutColour: '#2d2b29', ownG: false,
              slot: 0, tool: 'move', colour: '#1d4f9a', size: 10, guides: true, slots: [] };
  const SWATCHES = [['#1d4f9a', 'Cobalt'], ['#7fb3d9', 'Sky'], ['#3f8f73', 'Copper green'], ['#d8a23a', 'Ochre'],
                    ['#8e2f2a', 'Oxblood'], ['#5a3c6e', 'Manganese'], ['#1b1d24', 'Ink'], ['#fbfaf6', 'Tin white']];
  // multiply tints use the light palette whatever the theme, since the design itself does not change with theme
  const TINT = {
    type: ['#f28b82', '#86e1e8', '#ec90e0', '#8f919a', '#c094ef', '#8b94ee', '#8edc91', '#f7c38f', '#f3e682', '#cf463d'],
    four: ['#efd07c', '#e99c91', '#9bceb2', '#3349c2'],
    orient: ['#e9a69e', '#e8cf93', '#bbd79b', '#94cfc8', '#a4b1e6', '#d1a5dd', '#1b2033']
  };

  function bulgeCtrl(ax, ay, bx, by, e) {
    const s = C.tEdge(e) % 2 === 0 ? BULGE : -BULGE;
    return [(ax + bx) / 2 + (by - ay) * s, (ay + by) / 2 - (bx - ax) * s];
  }
  function polyPath(pts, curved) {
    const path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]);
    for (let e = 0; e < 14; e++) {
      const a = pts[e], b = pts[(e + 1) % 14];
      if (curved) { const q = bulgeCtrl(a[0], a[1], b[0], b[1], e); path.quadraticCurveTo(q[0], q[1], b[0], b[1]); }
      else path.lineTo(b[0], b[1]);
    }
    path.closePath(); return path;
  }
  const localPaths = {};
  function localPath() { const k = 'L' + S.curved; return localPaths[k] || (localPaths[k] = polyPath(BASE, S.curved)); }
  function uprightPath(r) {
    const key = 'U' + r + S.curved;
    if (!localPaths[key]) {
      const c = COS[r], s = SIN[r];
      localPaths[key] = polyPath(BASE.map(([x, y]) => { const dx = x - C0[0], dy = y - C0[1]; return [c * dx - s * dy, s * dx + c * dy]; }), S.curved);
    }
    return localPaths[key];
  }
  const TO_PX = [RES, 0, 0, -RES, -(C0[0] - RH) * RES, (C0[1] + RH) * RES];
  const MASK = (() => {
    const c = mk(TEXN), g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(...TO_PX); g.fill(polyPath(BASE, false));
    const d = g.getImageData(0, 0, TEXN, TEXN).data, m = new Uint8Array(TEXN * TEXN);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return m;
  })();

  function newSlot() {
    const draw = mk(TEXN), tex = mk(TEXN);
    return { bg: '#f4efe4', img: null, imgSrc: null, imgT: { x: BB.cx, y: BB.cy, s: 5, r: 0 },
             draw, dctx: draw.getContext('2d', { willReadFrequently: true }), tex, tctx: tex.getContext('2d'),
             avg: '#e9e3d7', pats: new Map(), undo: [], edited: false, loops: false, loopsInk: '#1d4f9a' };
  }
  const avgC = mk(24), avgG = avgC.getContext('2d', { willReadFrequently: true });
  function compose(sl) {
    const g = sl.tctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = sl.bg; g.fillRect(0, 0, TEXN, TEXN);
    if (sl.img) {
      g.save(); g.translate(lx2px(sl.imgT.x), ly2py(sl.imgT.y)); g.rotate(sl.imgT.r * Math.PI / 180);
      g.scale(sl.imgT.fx ? -1 : 1, sl.imgT.fy ? -1 : 1);
      const w = sl.imgT.s * RES, h = w * sl.img.height / sl.img.width;
      g.imageSmoothingQuality = 'high'; g.drawImage(sl.img, -w / 2, -h / 2, w, h); g.restore();
    }
    if (sl.loops) drawLoops(g, sl.loopsInk);
    g.drawImage(sl.draw, 0, 0);
    avgG.clearRect(0, 0, 24, 24); avgG.drawImage(sl.tex, 0, 0, 24, 24);
    const d = avgG.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let v = 0; v < 24; v++) for (let u = 0; u < 24; u++) {
      const px = Math.floor((u + 0.5) * TEXN / 24), py = Math.floor((v + 0.5) * TEXN / 24);
      if (!MASK[py * TEXN + px]) continue;
      const o = (v * 24 + u) * 4; r += d[o]; gg += d[o + 1]; b += d[o + 2]; n++;
    }
    sl.avg = n ? `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})` : sl.bg;
    sl.pats.clear();
  }
  function patternFor(g, sl, kind) {
    let m = sl.pats.get(g); if (!m) { m = {}; sl.pats.set(g, m); }
    if (m[kind]) return m[kind];
    const p = g.createPattern(kind === 'plane' ? (sl.img || sl.tex) : sl.tex, 'repeat');
    if (kind === 'turn') p.setTransform(new DOMMatrix([1 / RES, 0, 0, -1 / RES, C0[0] - RH, C0[1] + RH]));
    else if (kind === 'up') p.setTransform(new DOMMatrix([1 / RES, 0, 0, -1 / RES, -RH, RH]));
    return m[kind] = p;
  }

  // Edge loops (optional): an arc round alternate corners joins the midpoints of neighbouring edges,
  // meeting each edge square-on, so every arc carries on into the next tile.
  // Draws into a context whose transform is the identity in texture pixels.
  function drawLoops(g, ink) {
    g.save(); g.setTransform(...TO_PX); g.strokeStyle = ink; g.lineWidth = 0.13; g.lineCap = 'butt';
    for (let e = STARTER_PAR; e < 14; e += 2) {
      const a = BASE[e], v = BASE[(e + 1) % 14], b = BASE[(e + 2) % 14];
      const din = Math.atan2(v[1] - a[1], v[0] - a[0]), dout = Math.atan2(b[1] - v[1], b[0] - v[0]);
      let turn = dout - din; while (turn <= -Math.PI) turn += 2 * Math.PI; while (turn > Math.PI) turn -= 2 * Math.PI;
      g.beginPath(); g.arc(v[0], v[1], 0.5, dout, dout + Math.PI - turn, false); g.stroke();
    }
    g.fillStyle = ink; g.beginPath(); g.arc(C0[0], C0[1], 0.16, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---- painting the tiling with the design ----
  const slotOf = i => (D.ownG && P.tiles.sub[i] === 1) ? 1 : 0;
  function slotPath(s) {
    const key = 'slot|' + s + '|' + D.ownG + '|' + S.curved;
    if (cache[key]) return cache[key];
    const p = new Path2D(); for (let i = 0; i < P.N; i++) if (slotOf(i) === s) traceTile(p, i);
    return cache[key] = p;
  }
  function allPath() {
    const key = 'all|' + S.curved;
    if (cache[key]) return cache[key];
    const p = new Path2D(); for (let i = 0; i < P.N; i++) traceTile(p, i);
    return cache[key] = p;
  }
  function visibleTiles(view, w, h) {
    const x0 = -view.ox / view.s, x1 = (w - view.ox) / view.s, y1 = view.oy / view.s, y0 = (view.oy - h) / view.s;
    const bb = P.bbox, out = [];
    for (let i = 0; i < P.N; i++) { const b = i * 4; if (bb[b] <= x1 && bb[b + 2] >= x0 && bb[b + 1] <= y1 && bb[b + 3] >= y0) out.push(i); }
    return out;
  }
  function tileXform(g, i, K, OX, OY, up) {
    const k = P.tk[i];
    if (up) { g.setTransform(K, 0, 0, -K, K * P.cen[i * 2] + OX, -K * P.cen[i * 2 + 1] + OY); return uprightPath(k); }
    g.setTransform(K * COS[k], -K * SIN[k], -K * SIN[k], -K * COS[k], K * P.xy[i * 28] + OX, -K * P.xy[i * 28 + 1] + OY);
    return localPath();
  }
  function planePattern(g) {
    const sl = D.slots[0], src = sl.img || sl.tex, pat = patternFor(g, sl, 'plane'), q = D.planeSize / src.width;
    pat.setTransform(new DOMMatrix([q, 0, 0, -q, CORE[0] - D.planeSize / 2, CORE[1] + src.height * q / 2]));
    return pat;
  }
  function paintTextured(g, view, w, h, dpr) {
    const K = view.s * dpr, OX = view.ox * dpr, OY = view.oy * dpr;
    const up = D.placement === 'upright', plane = D.placement === 'plane', tiny = BB.w * view.s < 7;
    const tintOn = D.tint > 0 && S.colour !== 'plain';
    const gpx = D.grout === 'none' ? 0 : D.grout === 'bold' ? Math.max(1.5, view.s * 0.16) : Math.max(0.6, Math.min(2, view.s * 0.05));
    const vis = (plane || tiny) ? null : visibleTiles(view, w, h);
    if (vis && vis.length <= 2500) {
      // close up: one fill per visible Spectre, in that Spectre's own frame
      const ci = tintOn ? colourIndex() : null, tp = tintOn ? TINT[S.colour] : null;
      for (const i of vis) {
        const sl = D.slots[slotOf(i)], path = tileXform(g, i, K, OX, OY, up);
        if (!gpx) { g.strokeStyle = sl.avg; g.lineWidth = 0.8 / view.s; g.stroke(path); }
        g.fillStyle = patternFor(g, sl, up ? 'up' : 'turn'); g.fill(path);
        if (ci) {
          g.globalCompositeOperation = 'multiply'; g.globalAlpha = D.tint;
          g.fillStyle = tp[ci[i]]; g.fill(path);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }
      }
      if (gpx) {
        g.strokeStyle = D.groutColour; g.lineWidth = gpx / view.s;
        for (const i of vis) g.stroke(tileXform(g, i, K, OX, OY, up));
      }
      g.setTransform(K, 0, 0, -K, OX, OY);
      return;
    }
    // far away or picture mode: whole-patch paths
    for (const s of (D.ownG ? [0, 1] : [0])) { g.fillStyle = D.slots[s].avg; g.fill(slotPath(s)); }
    if (plane) { g.fillStyle = planePattern(g); g.fill(allPath()); }
    else if (vis) {
      for (const i of vis) { g.fillStyle = patternFor(g, D.slots[slotOf(i)], up ? 'up' : 'turn'); g.fill(tileXform(g, i, K, OX, OY, up)); }
      g.setTransform(K, 0, 0, -K, OX, OY);
    }
    if (tintOn) {
      const fp = fills(), tp = TINT[S.colour];
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = D.tint;
      for (let c = 0; c < fp.length; c++) if (fp[c]) { g.fillStyle = tp[c]; g.fill(fp[c]); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (gpx && view.s > 2) { g.strokeStyle = D.groutColour; g.lineWidth = gpx / view.s; g.stroke(edgesPath()); }
  }

  // ---- studio ----
  const studio = $('studio'), ed = $('ed'), ectx = ed.getContext('2d'), pv = $('pv'), pctx = pv.getContext('2d');
  let EW = 0, EH = 0, ES = 40, ECX = 0, ECY = 0, PW = 0, PH = 0, edRaf = 0, cursorPt = null, studioOpen = false;

  let stroke = null, dragImg = null, noteT = 0;
  const cur = () => D.slots[D.slot];
  const e2l = (ex, ey) => [BB.cx + (ex - ECX) / ES, BB.cy - (ey - ECY) / ES];
  const l2e = (x, y) => [ECX + (x - BB.cx) * ES, ECY - (y - BB.cy) * ES];
  const toPx = (ex, ey) => { const [x, y] = e2l(ex, ey); return [lx2px(x), ly2py(y)]; };
  function note(t) { const n = $('stNote'); n.textContent = t; clearTimeout(noteT); noteT = setTimeout(() => { n.textContent = ''; }, 4000); }

  function edResize() {
    if (!studioOpen) return;
    const r = ed.getBoundingClientRect(); EW = r.width; EH = r.height;
    ed.width = Math.max(1, Math.round(EW * DPR)); ed.height = Math.max(1, Math.round(EH * DPR));
    const pr = pv.getBoundingClientRect(); PW = pr.width; PH = pr.height;
    pv.width = Math.max(1, Math.round(PW * DPR)); pv.height = Math.max(1, Math.round(PH * DPR));
    // fit the tile, keeping clear of the preview
    let aw = EW, ah = EH, ay = 0;
    if (EW >= 700) aw = EW - 272; else { ay = PH + 14; ah = EH - ay; }
    ES = Math.max(12, Math.min((aw - 56) / (BB.w + 0.7), (ah - 56) / (BB.h + 0.7)));
    ECX = aw / 2; ECY = ay + ah / 2;
    edRequest();
  }
  function edRequest() { if (!edRaf) edRaf = requestAnimationFrame(() => { edRaf = 0; drawEditor(); drawPreview(); }); }
  function localToScreen(g) { g.setTransform(DPR * ES, 0, 0, -DPR * ES, DPR * (ECX - BB.cx * ES), DPR * (ECY + BB.cy * ES)); }
  function drawEditor() {
    if (!studioOpen || !EW) return;
    const g = ectx, sl = gLocked() ? D.slots[0] : cur();
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAL.stage; g.fillRect(0, 0, ed.width, ed.height);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const [tx, ty] = l2e(C0[0] - RH, C0[1] + RH), sz = 2 * RH * ES;
    g.globalAlpha = 0.28; g.drawImage(sl.tex, tx, ty, sz, sz); g.globalAlpha = 1;
    g.save(); localToScreen(g); g.clip(localPath()); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.drawImage(sl.tex, tx, ty, sz, sz); g.restore();
    localToScreen(g); g.strokeStyle = PAL.ink; g.lineWidth = 1.6 / ES; g.lineJoin = 'round'; g.stroke(localPath());
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (D.guides) {
      g.font = `500 11px ${FONT_M}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let e = 0; e < 14; e++) {
        const a = BASE[e], b = BASE[(e + 1) % 14], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const [x, y] = l2e(mx, my), [nx, ny] = l2e(mx + (b[1] - a[1]) * 0.3, my - (b[0] - a[0]) * 0.3);
        g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fillStyle = PAL.accent; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = PAL.halo; g.stroke();
        g.fillStyle = PAL.muted; g.fillText(String(C.tEdge(e)), nx, ny);
      }
    }
    if (cursorPt && (D.tool === 'brush' || D.tool === 'eraser')) {
      g.beginPath(); g.arc(cursorPt[0], cursorPt[1], Math.max(1.5, D.size * 0.01 * ES / 2), 0, Math.PI * 2);
      g.lineWidth = 3; g.strokeStyle = PAL.halo; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = PAL.ink; g.stroke();
    }
  }
  function drawPreview() {
    if (!studioOpen || !PW || !P) return;
    const view = { s: PW / 19 };
    const i = S.sel >= 0 ? S.sel : 0;
    view.ox = PW / 2 - P.cen[i * 2] * view.s; view.oy = PH / 2 + P.cen[i * 2 + 1] * view.s;
    paintBase(pctx, view, PW, PH, DPR, true);
  }

  function snapshot(sl) { return { draw: sl.dctx.getImageData(0, 0, TEXN, TEXN), bg: sl.bg, img: sl.img, imgSrc: sl.imgSrc, imgT: Object.assign({}, sl.imgT), loops: sl.loops, loopsInk: sl.loopsInk }; }
  function pushUndo(sl) { sl.undo.push(snapshot(sl)); if (sl.undo.length > 10) sl.undo.shift(); }
  function undo() {
    const sl = cur(), s = sl.undo.pop();
    if (!s) { note('Nothing to undo'); return; }
    sl.dctx.putImageData(s.draw, 0, 0); sl.bg = s.bg; sl.img = s.img; sl.imgSrc = s.imgSrc; sl.imgT = s.imgT; sl.loops = s.loops; sl.loopsInk = s.loopsInk;
    changed(sl, true); syncStudio();
  }
  function changed(sl, commit) {
    if (sl === D.slots[1]) sl.edited = true;
    compose(sl);
    if (!D.on) { D.on = true; syncDesign(); }
    edRequest();
    if (!studioOpen) request();
    if (commit) { renderThumbs(); save(); }
  }
  function paintSeg(sl, a, b) {
    const g = sl.dctx;
    g.globalCompositeOperation = D.tool === 'eraser' ? 'destination-out' : 'source-over';
    g.strokeStyle = D.colour; g.lineWidth = D.size * 0.01 * RES; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }
  function flood(sl, px, py, rgb) {
    px = Math.floor(px); py = Math.floor(py);
    if (px < 0 || py < 0 || px >= TEXN || py >= TEXN || !MASK[py * TEXN + px]) return false;
    const src = sl.tctx.getImageData(0, 0, TEXN, TEXN).data, out = sl.dctx.getImageData(0, 0, TEXN, TEXN), dd = out.data;
    const o0 = (py * TEXN + px) * 4, r0 = src[o0], g0 = src[o0 + 1], b0 = src[o0 + 2];
    const seen = new Uint8Array(TEXN * TEXN), st = [py * TEXN + px];
    while (st.length) {
      const p = st.pop(); if (seen[p]) continue; seen[p] = 1;
      if (!MASK[p]) continue;
      const q = p * 4;
      if (Math.abs(src[q] - r0) + Math.abs(src[q + 1] - g0) + Math.abs(src[q + 2] - b0) > 66) continue;
      dd[q] = rgb[0]; dd[q + 1] = rgb[1]; dd[q + 2] = rgb[2]; dd[q + 3] = 255;
      const x = p % TEXN;
      if (x > 0) st.push(p - 1); if (x < TEXN - 1) st.push(p + 1);
      if (p >= TEXN) st.push(p - TEXN); if (p < TEXN * (TEXN - 1)) st.push(p + TEXN);
    }
    sl.dctx.putImageData(out, 0, 0); return true;
  }
  const edPt = e => { const r = ed.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const edPtrs = new Map();
  let gesture = null, waitAllUp = false, fillAt = null;
  function beginAction(ex, ey) {
    const sl = cur();
    if (gLocked()) { note('Tap “Give them their own design” first'); return; }
    if (D.tool === 'brush' || D.tool === 'eraser') {
      pushUndo(sl); stroke = { last: toPx(ex, ey) }; paintSeg(sl, stroke.last, stroke.last); changed(sl);
    } else if (D.tool === 'fill') {
      fillAt = [ex, ey];                                 // fill on release, so a pinch never fills
    } else if (D.tool === 'move') {
      if (!sl.img) { note('Add a picture first, then drag it into place'); return; }
      pushUndo(sl); dragImg = { ex, ey, x: sl.imgT.x, y: sl.imgT.y };
    }
  }
  function cancelAction() {
    fillAt = null;
    if (!stroke && !dragImg) return;
    const sl = cur(), snap = sl.undo.pop();
    if (snap) { sl.dctx.putImageData(snap.draw, 0, 0); sl.imgT = snap.imgT; }
    stroke = null; dragImg = null; compose(sl); edRequest();
  }
  function finishAction(ex, ey) {
    if (fillAt) {
      const sl = cur(), moved = Math.hypot(ex - fillAt[0], ey - fillAt[1]) > 10; fillAt = null;
      if (moved || gLocked()) return;
      pushUndo(sl); const [px, py] = toPx(ex, ey);
      if (flood(sl, px, py, hexRGB(D.colour))) changed(sl, true); else { sl.undo.pop(); note('Tap inside the tile to fill an area'); }
      return;
    }
    if (stroke || dragImg) { stroke = null; dragImg = null; changed(cur(), true); }
  }
  function pinchState() {
    const [a, b] = [...edPtrs.values()];
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
  }
  ed.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    try { ed.setPointerCapture(e.pointerId); } catch (_) {}
    const p = edPt(e); edPtrs.set(e.pointerId, p); cursorPt = p;
    if (edPtrs.size >= 2) {
      cancelAction();
      const st = pinchState(); gesture = { d0: st.d, m0: st.m, t0: st.t, active: false };
      return;
    }
    if (!waitAllUp) beginAction(p[0], p[1]);
  });
  ed.addEventListener('pointermove', e => {
    const p = edPt(e); cursorPt = p;
    if (edPtrs.has(e.pointerId)) edPtrs.set(e.pointerId, p);
    if (gesture) {
      if (edPtrs.size < 2) return;
      const st = pinchState();
      if (!gesture.active) {
        // a small dead zone, so resting two fingers on the glass does not jolt the picture
        if (gesture.inert || (Math.abs(st.d - gesture.d0) < 14 && Math.hypot(st.m[0] - gesture.m0[0], st.m[1] - gesture.m0[1]) < 8
            && Math.abs(wrapDeg(st.t - gesture.t0)) < 6)) return;
        const sl = cur();
        if (gLocked() || !sl.img) { gesture.inert = true; if (!gLocked()) note('Add a picture, then use two fingers to resize and turn it'); return; }
        pushUndo(sl);
        gesture = { d0: st.d, m0: st.m, t0: gesture.t0, s0: sl.imgT.s, r0: sl.imgT.r, c0: l2e(sl.imgT.x, sl.imgT.y), rotOn: false, tr: 0, active: true };
        return;
      }
      // Size is damped: the picture grows more slowly than the fingers spread. Turning starts once the fingers
      // have turned 10°, so a plain pinch does not tilt the picture, then catches up to follow them exactly.
      const sl = cur(), f = Math.pow(st.d / Math.max(1, gesture.d0), 0.6);
      setPicScale(sl, gesture.s0 * f);
      const turned = wrapDeg(st.t - gesture.t0);
      if (!gesture.rotOn && Math.abs(turned) > 10) { gesture.rotOn = true; gesture.tr = turned; }
      const lag = gesture.rotOn ? gesture.tr * Math.max(0, 1 - Math.abs(wrapDeg(turned - gesture.tr)) / 30) : 0;
      let dr = gesture.rotOn ? wrapDeg(turned - lag) : 0;
      let r = wrapDeg(gesture.r0 + dr);
      const snap = Math.round(r / 45) * 45;                  // settle onto 0°, 45°, 90°… when close
      if (Math.abs(r - snap) < 2.5) { dr += snap - r; r = wrapDeg(snap); }
      const k = sl.imgT.s / gesture.s0, rad = dr * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
      const vx = (gesture.c0[0] - gesture.m0[0]) * k, vy = (gesture.c0[1] - gesture.m0[1]) * k;
      const c = e2l(st.m[0] + vx * cs - vy * sn, st.m[1] + vx * sn + vy * cs);
      sl.imgT.x = c[0]; sl.imgT.y = c[1]; sl.imgT.r = r;
      changed(sl); syncScaleLabel(sl);
      return;
    }
    const sl = cur(), [ex, ey] = p;
    if (stroke) { const q = toPx(ex, ey); paintSeg(sl, stroke.last, q); stroke.last = q; changed(sl); }
    else if (dragImg) { sl.imgT.x = dragImg.x + (ex - dragImg.ex) / ES; sl.imgT.y = dragImg.y - (ey - dragImg.ey) / ES; changed(sl); }
    else edRequest();
  });
  function edUp(e) {
    const p = edPt(e);
    edPtrs.delete(e.pointerId);
    if (gesture) {
      if (edPtrs.size < 2) {
        if (gesture.active) { changed(cur(), true); syncStudio(); }
        gesture = null; waitAllUp = edPtrs.size > 0;
      }
      return;
    }
    if (edPtrs.size === 0) waitAllUp = false;
    if (e.type === 'pointercancel') { cancelAction(); return; }
    finishAction(p[0], p[1]);
  }
  ed.addEventListener('pointerup', edUp);
  ed.addEventListener('pointercancel', edUp);
  ed.addEventListener('pointerleave', () => { cursorPt = null; edRequest(); });
  // scroll in Move picture, or a trackpad pinch (ctrl+wheel) anywhere, resizes the picture
  ed.addEventListener('wheel', e => {
    e.preventDefault();
    const sl = cur();
    if (gLocked() || !sl.img || (D.tool !== 'move' && !e.ctrlKey)) return;
    setPicScale(sl, sl.imgT.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.006 : 0.0012)));
    changed(sl, true); syncStudio();
  }, { passive: false });
  // keep the page itself from zooming while the studio is open (Safari's own pinch gesture)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => studio.addEventListener(t, e => e.preventDefault(), { passive: false }));

  // ---- pictures ----
  function loadFile(file) {
    if (gLocked()) { note('Tap “Give them their own design” first'); return; }
    if (!file || !/^image\//.test(file.type)) { note('That file is not a picture'); return; }
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { setPicture(im, file.type !== 'image/jpeg'); URL.revokeObjectURL(url); };
    im.onerror = () => { note('That picture could not be opened'); URL.revokeObjectURL(url); };
    im.src = url;
  }
  function setPicture(im, keepAlpha) {
    const w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height;
    if (!w0 || !h0) { note('That picture is empty'); return; }
    const f = Math.min(1, 1400 / Math.max(w0, h0)), c = mk(Math.max(1, Math.round(w0 * f)), Math.max(1, Math.round(h0 * f)));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const sl = cur(); pushUndo(sl);
    sl.img = c; sl.imgT.fx = false; sl.imgT.fy = false;
    try { sl.imgSrc = c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.88); } catch (_) { sl.imgSrc = null; }
    fitPicture(sl); D.tool = 'move';
    const hadLoops = sl.loops; sl.loops = false;
    changed(sl, true); syncStudio(); syncDesign();
    note(hadLoops ? 'Picture added and edge loops switched off. Drag the picture to place it' : 'Picture added. Drag it to place it, or use Scale and Turn');
  }
  const fitScale = sl => Math.max(BB.w, BB.h * sl.img.width / sl.img.height) * 1.04;   // just covers the tile
  const SCALE_MIN = 0.25, SCALE_MAX = 8;                                                // relative to that
  function setPicScale(sl, s) { const f = fitScale(sl); sl.imgT.s = clamp(s, f * SCALE_MIN, f * SCALE_MAX); }
  const wrapDeg = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
  function syncScaleLabel(sl) {
    $('imgRotVal').textContent = sl.img ? Math.round(sl.imgT.r) + '°' : '';
    if (sl.img) $('imgRot').value = Math.round(sl.imgT.r);
    const rel = sl.img ? sl.imgT.s / fitScale(sl) : 1;
    $('imgScaleVal').textContent = sl.img ? Math.round(rel * 100) + '%' : '';
    if (sl.img) $('imgScale').value = Math.round(50 * Math.log2(rel));
  }
  function fitPicture(sl) {
    if (!sl.img) return;
    sl.imgT = { x: BB.cx, y: BB.cy, s: fitScale(sl), r: 0, fx: !!sl.imgT.fx, fy: !!sl.imgT.fy };   // Fit keeps any mirroring
  }
  $('imgFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
  const stStage = $('stStage'), dropEl = $('drop');
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  stStage.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); dropEl.hidden = false; });
  stStage.addEventListener('dragleave', e => { if (e.target === stStage || e.target === ed) dropEl.hidden = true; });
  stStage.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dropEl.hidden = true; loadFile(e.dataTransfer.files[0]); });
  stage.addEventListener('dragover', e => { if (!studioOpen && hasFiles(e)) { e.preventDefault(); } });
  stage.addEventListener('drop', e => { if (studioOpen || !hasFiles(e)) return; e.preventDefault(); openStudio(); loadFile(e.dataTransfer.files[0]); });
  document.addEventListener('paste', e => {
    if (!studioOpen || !e.clipboardData) return;
    const it = [...e.clipboardData.items].find(x => x.type && x.type.startsWith('image/'));
    if (it) { e.preventDefault(); loadFile(it.getAsFile()); }
  });

  // ---- − / + steppers for sliders: tap for one step, hold to repeat ----
  const steppers = [];
  function addStepper(input, step, name) {
    const mkBtn = (txt, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'step-btn'; b.textContent = txt; b.setAttribute('aria-label', label); return b; };
    const minus = mkBtn('−', 'Decrease ' + name), plus = mkBtn('+', 'Increase ' + name);
    input.before(minus); input.after(plus);
    let timer = 0, moved = false;
    const bump = dir => {
      if (input.disabled) return;
      const v = clamp(+input.value + dir * step, +input.min, +input.max);
      if (v === +input.value) return;
      input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); moved = true;
    };
    const stop = () => {
      clearTimeout(timer); clearInterval(timer); timer = 0;
      if (moved) { moved = false; input.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    [[minus, -1], [plus, 1]].forEach(([b, dir]) => {
      b.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        e.preventDefault(); stop(); bump(dir);
        timer = setTimeout(() => { timer = setInterval(() => bump(dir), 70); }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
      b.addEventListener('click', e => { if (e.detail === 0) { bump(dir); stop(); } });   // keyboard
    });
    steppers.push({ input, minus, plus });
  }
  function syncSteppers() { for (const s of steppers) s.minus.disabled = s.plus.disabled = s.input.disabled; }

  // ---- studio controls ----
  function sliderUndo(el, apply) {
    let armed = false;
    el.addEventListener('input', () => { if (gLocked()) return; const sl = cur(); if (!armed) { pushUndo(sl); armed = true; } apply(sl); changed(sl); });
    el.addEventListener('change', () => { if (gLocked()) return; armed = false; changed(cur(), true); });
  }
  seg($('slotSeg'), [{ v: 0, label: 'Every Spectre' }, { v: 1, label: 'Turned G halves' }], v => {
    D.slot = +v; syncStudio(); edRequest();
  });
  // The turned G halves either share the main design or have their own (slot 1).
  const gLocked = () => D.slot === 1 && !D.ownG;
  function copySlot(from, to) {
    to.loops = from.loops; to.loopsInk = from.loopsInk;
    to.bg = from.bg; to.img = from.img; to.imgSrc = from.imgSrc; to.imgT = Object.assign({}, from.imgT);
    to.dctx.clearRect(0, 0, TEXN, TEXN); to.dctx.drawImage(from.draw, 0, 0);
    compose(to);
  }
  function afterG(msg) {
    syncDesign(); syncStudio(); renderThumbs(); save(); request(); edRequest();
    if (msg && studioOpen) note(msg);
  }
  function giveGOwn() {
    const g = D.slots[1], restoring = g.edited;
    if (!restoring) { copySlot(D.slots[0], g); g.undo = []; }
    D.ownG = true;
    afterG(restoring ? 'The turned G halves have their earlier design back' : 'The turned G halves start from a copy of your main design');
  }
  function dropGOwn() {
    D.ownG = false;
    afterG('The turned G halves use your main design again');
  }
  $('gBannerA').addEventListener('click', () => {
    if (!D.ownG) { giveGOwn(); return; }
    const g = D.slots[1]; pushUndo(g); copySlot(D.slots[0], g); changed(g, true); syncStudio();
    note('Copied the main design. Undo brings back the previous one');
  });
  $('gBannerB').addEventListener('click', dropGOwn);
  seg($('toolSeg'), [{ v: 'brush', label: 'Brush' }, { v: 'eraser', label: 'Eraser' }, { v: 'fill', label: 'Fill' }, { v: 'move', label: 'Move picture' }],
    v => { D.tool = v; syncStudio(); edRequest(); });
  (function () {
    const box = $('swatches');
    SWATCHES.forEach(([c, n]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sw-btn'; b.style.background = c; b.title = n; b.setAttribute('aria-label', n); b.dataset.c = c;
      b.addEventListener('click', () => { D.colour = c; if (D.tool === 'eraser' || D.tool === 'move') D.tool = 'brush'; syncStudio(); save(); });
      box.appendChild(b);
    });
  })();
  $('brushColour').addEventListener('input', e => { D.colour = e.target.value; if (D.tool === 'eraser' || D.tool === 'move') D.tool = 'brush'; syncStudio(); });
  $('brushSize').addEventListener('input', e => { D.size = +e.target.value; edRequest(); });
  $('undoBtn').addEventListener('click', () => { if (!gLocked()) undo(); });
  $('clearBtn').addEventListener('click', () => {
    if (gLocked()) return; const sl = cur(); pushUndo(sl);
    sl.dctx.clearRect(0, 0, TEXN, TEXN); sl.loops = false;
    changed(sl, true); syncStudio(); note('Drawing and edge loops cleared. Undo brings them back');
  });
  $('tLoops').addEventListener('change', e => {
    const sl = cur(); if (gLocked()) { e.target.checked = sl.loops; return; }
    pushUndo(sl); sl.loops = e.target.checked; if (sl.loops) sl.loopsInk = D.colour;
    changed(sl, true);
  });
  sliderUndo($('imgScale'), sl => {
    if (!sl.img) return;
    setPicScale(sl, fitScale(sl) * Math.pow(2, +$('imgScale').value / 50));
    $('imgScaleVal').textContent = Math.round(sl.imgT.s / fitScale(sl) * 100) + '%';
  });
  sliderUndo($('imgRot'), sl => { if (sl.img) { sl.imgT.r = +$('imgRot').value; $('imgRotVal').textContent = sl.imgT.r + '°'; } });
  sliderUndo($('bgColour'), sl => { sl.bg = $('bgColour').value; });
  // Mirror and flip as seen on screen, about the picture's centre: toggling the picture's own axis
  // and negating its turn gives the same result as reflecting the turned picture.
  function flipPicture(axis) {
    const sl = cur(); if (gLocked() || !sl.img) return;
    pushUndo(sl);
    if (axis === 'x') sl.imgT.fx = !sl.imgT.fx; else sl.imgT.fy = !sl.imgT.fy;
    sl.imgT.r = wrapDeg(-sl.imgT.r);
    changed(sl, true); syncStudio();
  }
  $('imgMirror').addEventListener('click', () => flipPicture('x'));
  $('imgFlip').addEventListener('click', () => flipPicture('y'));
  $('imgFit').addEventListener('click', () => { const sl = cur(); if (gLocked() || !sl.img) return; pushUndo(sl); fitPicture(sl); changed(sl, true); syncStudio(); });
  $('imgRemove').addEventListener('click', () => {
    const sl = cur(); if (gLocked() || !sl.img) return; pushUndo(sl); sl.img = null; sl.imgSrc = null;
    if (D.tool === 'move') D.tool = 'brush';
    changed(sl, true); syncStudio(); syncDesign(); note('Picture removed. Undo brings it back');
  });
  $('tGuides').addEventListener('change', e => { D.guides = e.target.checked; edRequest(); });
  addStepper($('brushSize'), 1, 'brush size');
  addStepper($('imgScale'), 5, 'picture scale');
  addStepper($('imgRot'), 1, 'picture turn');
  addStepper($('planeSize'), 2, 'picture width');
  addStepper($('tint'), 5, 'tint');
  $('stDone').addEventListener('click', closeStudio);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && studioOpen) closeStudio(); });
  new ResizeObserver(() => edResize()).observe(stStage);

  function syncStudio() {
    const sl = cur();
    press($('slotSeg'), D.slot); press($('toolSeg'), D.tool);
    for (const b of $('swatches').children) b.setAttribute('aria-pressed', String(b.dataset.c === D.colour));
    $('brushColour').value = D.colour; $('brushSize').value = D.size; $('bgColour').value = sl.bg;
    $('tLoops').checked = !!(gLocked() ? D.slots[0] : sl).loops;
    const hasImg = !!sl.img;
    $('imgScale').disabled = $('imgRot').disabled = $('imgFit').disabled = $('imgRemove').disabled = $('imgMirror').disabled = $('imgFlip').disabled = !hasImg;
    syncSteppers();
    syncScaleLabel(sl);
    ed.classList.toggle('move', D.tool === 'move');
    const locked = gLocked();
    studio.classList.toggle('locked', locked);
    $('gBanner').hidden = D.slot !== 1;
    if (D.slot === 1) {
      $('gBannerText').textContent = D.ownG ? 'The turned G halves have their own design.' : 'The turned G halves use your main design.';
      $('gBannerA').textContent = D.ownG ? 'Copy main design' : (D.slots[1].edited ? 'Bring back their own design' : 'Give them their own design');
      $('gBannerB').hidden = !D.ownG;
    }
  }
  function openStudio(slot) {
    if (slot != null) D.slot = slot;
    studio.hidden = false; studioOpen = true; document.documentElement.classList.add('studio-open');
    syncStudio(); requestAnimationFrame(edResize);
    setTimeout(() => $('stDone').focus({ preventScroll: true }), 0);
  }
  function closeStudio() {
    studio.hidden = true; studioOpen = false; stroke = null; dragImg = null;
    document.documentElement.classList.remove('studio-open');
    renderThumbs(); request();
  }

  // ---- panel controls ----
  seg($('placeSeg'), [{ v: 'turn', label: 'Turn with tile' }, { v: 'upright', label: 'Keep upright' }, { v: 'plane', label: 'Picture across plane' }],
    v => { D.placement = v; D.on = true; syncDesign(); save(); request(); });
  seg($('groutSeg'), [{ v: 'none', label: 'None' }, { v: 'fine', label: 'Fine' }, { v: 'bold', label: 'Bold' }],
    v => { D.grout = v; syncDesign(); save(); request(); });
  $('planeSize').addEventListener('input', e => { D.planeSize = +e.target.value; syncDesign(); request(); });
  $('planeSize').addEventListener('change', save);
  $('tint').addEventListener('input', e => { D.tint = +e.target.value / 100; syncDesign(); request(); });
  $('tint').addEventListener('change', save);
  $('groutColour').addEventListener('input', e => { D.groutColour = e.target.value; request(); });
  $('groutColour').addEventListener('change', save);
  $('tDesign').addEventListener('change', e => { D.on = e.target.checked; syncDesign(); save(); request(); });
  $('tOwnG').addEventListener('change', e => { if (e.target.checked) giveGOwn(); else dropGOwn(); });
  $('removeG').addEventListener('click', dropGOwn);
  $('openStudio').addEventListener('click', () => openStudio());
  $('launchStudio').addEventListener('click', () => openStudio());
  [$('thumb0'), $('thumb1')].forEach((t, k) => t.addEventListener('click', () => openStudio(k)));

  function syncDesign() {
    $('tDesign').checked = D.on; $('tOwnG').checked = D.ownG;
    press($('placeSeg'), D.placement); press($('groutSeg'), D.grout);
    $('planeRow').hidden = D.placement !== 'plane';
    $('planeSize').value = D.planeSize; $('planeVal').textContent = D.planeSize;
    $('tint').value = Math.round(D.tint * 100); $('tintVal').textContent = Math.round(D.tint * 100) + '%';
    $('groutColour').value = D.groutColour;
    $('tfig1').hidden = !D.ownG;
    const hasImg = D.slots[0] && D.slots[0].img;
    const txt = {
      turn: 'The design turns with every Spectre, so the twelve rotations of the tiling show up in the pattern.',
      upright: 'The design stays upright and each Spectre cuts its own outline out of it.',
      plane: hasImg ? 'One picture lies under the whole tiling, and each Spectre shows its own piece of it.'
                    : 'Add a picture in the tile studio to spread it under the whole tiling. Until then your tile design repeats.'
    }[D.placement];
    $('designNote').textContent = (D.on ? '' : 'Switch on “Use on the tiling” to see it. ') + txt;
  }
  function renderThumbs() {
    [0, 1].forEach(k => {
      const c = $('thumb' + k); if (k === 1 && !D.ownG) return;
      const r = c.getBoundingClientRect(), w = r.width || 92, h = r.height || 66;
      c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
      const g = c.getContext('2d'), sl = D.slots[k];
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
      const s = Math.min((w - 10) / BB.w, (h - 10) / BB.h), cx = w / 2, cy = h / 2;
      const L = () => g.setTransform(DPR * s, 0, 0, -DPR * s, DPR * (cx - BB.cx * s), DPR * (cy + BB.cy * s));
      g.save(); L(); g.clip(localPath());
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.drawImage(sl.tex, cx + (C0[0] - RH - BB.cx) * s, cy - (C0[1] + RH - BB.cy) * s, 2 * RH * s, 2 * RH * s);
      g.restore(); L(); g.strokeStyle = PAL.ink; g.lineWidth = 1.2 / s; g.lineJoin = 'round'; g.stroke(localPath());
    });
  }

  // ---- keeping the design in this browser ----
  const LS = 'spectre-lab-design-v1';
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(doSave, 700); }
  function doSave() {
    const o = { on: D.on, placement: D.placement, planeSize: D.planeSize, tint: D.tint, grout: D.grout,
                groutColour: D.groutColour, ownG: D.ownG, colour: D.colour, size: D.size };
    let slots;
    try { slots = D.slots.map(sl => ({ bg: sl.bg, imgT: sl.imgT, imgSrc: sl.imgSrc, edited: !!sl.edited, loops: !!sl.loops, loopsInk: sl.loopsInk, draw: sl.draw.toDataURL('image/png') })); } catch (_) { return; }
    try { localStorage.setItem(LS, JSON.stringify({ o, slots })); }
    catch (_) {
      try { localStorage.setItem(LS, JSON.stringify({ o, slots: slots.map(s => Object.assign({}, s, { imgSrc: null })) })); note('The picture is too large to keep in this browser; the drawing is kept'); } catch (__) {}
    }
  }
  // Before 1.3.2 new designs had loops painted into the drawing itself. Erase pixels that match them.
  function stripLoops(sl, ink) {
    const t = mk(TEXN), tg = t.getContext('2d', { willReadFrequently: true }); drawLoops(tg, ink);
    const a = tg.getImageData(0, 0, TEXN, TEXN).data, img = sl.dctx.getImageData(0, 0, TEXN, TEXN), b = img.data;
    let hit = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] === 0 || b[i + 3] === 0) continue;
      const faint = a[i + 3] < 64 && b[i + 3] < 64;
      const same = Math.abs(a[i] - b[i]) <= 24 && Math.abs(a[i + 1] - b[i + 1]) <= 24 && Math.abs(a[i + 2] - b[i + 2]) <= 24 && Math.abs(a[i + 3] - b[i + 3]) <= 40;
      if (faint || same) { b[i] = b[i + 1] = b[i + 2] = b[i + 3] = 0; hit++; }
    }
    if (hit) sl.dctx.putImageData(img, 0, 0);
    return hit;
  }
  function inkCount(sl) {
    const d = sl.dctx.getImageData(0, 0, TEXN, TEXN).data; let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 16) n++;
    return n;
  }
  function loadImg(src, cb) { const im = new Image(); im.onload = () => cb(im); im.src = src; }
  function loadDesign() {
    D.slots = [newSlot(), newSlot()];
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (_) {}
    if (!data || !data.slots) { D.slots.forEach(compose); return; }
    const o = data.o || {};
    ['on', 'placement', 'planeSize', 'tint', 'grout', 'groutColour', 'ownG', 'colour', 'size'].forEach(k => { if (o[k] !== undefined) D[k] = o[k]; });
    const after = () => { renderThumbs(); request(); edRequest(); };
    data.slots.forEach((s, k) => {
      const sl = D.slots[k]; if (!sl || !s) return;
      if (s.bg) sl.bg = s.bg; if (s.imgT) sl.imgT = s.imgT;
      sl.edited = !!s.edited; sl.loops = !!s.loops; if (s.loopsInk) sl.loopsInk = s.loopsInk;
      compose(sl);
      // Before 1.3.1 the G-halves tab switched on a separate design by itself, holding an untouched starter.
      const legacyG = k === 1 && s.edited === undefined, legacyLoops = s.loops === undefined;
      const settle = () => {
        // main designs started with cobalt loops; the G-halves design with oxblood ones, or a copy of the main design
        if (legacyLoops) { stripLoops(sl, '#1d4f9a'); if (k === 1 && !s.edited) stripLoops(sl, '#8e2f2a'); compose(sl); }
        if (legacyG) {
          sl.edited = !(s.bg === '#f0e2c6' && !s.imgSrc && inkCount(sl) < 400);
          if (D.ownG && !sl.edited) { D.ownG = false; syncDesign(); }
        }
        if (legacyLoops || legacyG) save();
      };
      if (s.draw) loadImg(s.draw, im => { sl.dctx.drawImage(im, 0, 0); compose(sl); settle(); after(); });
      else settle();
      if (s.imgSrc) loadImg(s.imgSrc, im => { const c = mk(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); sl.img = c; sl.imgSrc = s.imgSrc; compose(sl); after(); });
    });
  }
  function focusOn(i) {
    V.s = clamp(0.42 * Math.min(W, H) / BB.w, 6, 420);
    centreOn(i);
  }

  // ---------- export: PNG or a one-page PDF of the view or the whole patch ----------
  const X = { area: 'view', format: 'png', size: 4000, page: 'a4', transparent: false, overlays: true, busy: false };
  const PAGES = { a4: { pt: [595.28, 841.89], label: 'A4' }, a3: { pt: [841.89, 1190.55], label: 'A3' }, letter: { pt: [612, 792], label: 'Letter' } };
  const PDF_MARGIN = 28.35, PDF_CAPTION = 14, PDF_DPI = 300;
  let downloadsApi = null, previewUrl = null;
  (async () => {
    try { if (window.claude && typeof window.claude.use === 'function') downloadsApi = await window.claude.use('downloads'); } catch (_) { downloadsApi = null; }
    if (P) syncExport();
  })();

  function exportPlan(longEdge) {
    if (X.area === 'view') {
      return { view: { s: V.s, ox: V.ox, oy: V.oy }, w: W, h: H, dpr: longEdge / Math.max(W, H) };
    }
    const [x0, y0, x1, y1] = P.box, m = 0.03 * Math.max(x1 - x0, y1 - y0);
    const ww = x1 - x0 + 2 * m, wh = y1 - y0 + 2 * m, K = longEdge / Math.max(ww, wh);
    const s = clamp(K / 2, 2, 40);
    return { view: { s, ox: -(x0 - m) * s, oy: (y1 + m) * s }, w: ww * s, h: wh * s, dpr: K / s };
  }
  function pdfLongEdge() {
    const pt = PAGES[X.page].pt, aspect = X.area === 'view' ? W / H : (P.box[2] - P.box[0]) / (P.box[3] - P.box[1]);
    let [pw, ph] = pt; if (aspect > 1) [pw, ph] = [ph, pw];
    const aw = pw - 2 * PDF_MARGIN, ah = ph - 2 * PDF_MARGIN - PDF_CAPTION;
    const sc = Math.min(aw / aspect, ah);         // printed height in pt for an image of this aspect
    const printedLong = Math.max(sc * aspect, sc);
    return Math.min(4800, Math.round(printedLong / 72 * PDF_DPI));
  }
  function renderExport(longEdge, bg) {
    const pl = exportPlan(longEdge);
    const cw = Math.max(1, Math.round(pl.w * pl.dpr)), ch = Math.max(1, Math.round(pl.h * pl.dpr));
    const c = mk(cw, ch), g = c.getContext('2d');
    if (!g) throw new Error('too-large');
    try {
      paintBase(g, pl.view, pl.w, pl.h, pl.dpr, D.on, bg);
      if (X.overlays) {
        paintOutline(g, pl.view, pl.dpr);
        if (S.letters) { g.setTransform(pl.dpr, 0, 0, pl.dpr, 0, 0); drawLetters(g, pl.view, pl.w, pl.h); }
      }
    } finally { D.slots.forEach(sl => sl.pats.delete(g)); }
    return c;
  }
  const toBlob = (c, type, q) => new Promise((res, rej) => {
    try { c.toBlob(b => b ? res(b) : rej(new Error('too-large')), type, q); } catch (_) { rej(new Error('too-large')); }
  });

  function buildPdf(jpeg, iw, ih, pageKey, cap) {
    return FileFormats.buildPdf({ jpeg, width: iw, height: ih, page: PAGES[pageKey].pt, margin: PDF_MARGIN, captionHeight: PDF_CAPTION,
      caption: cap, title: 'Spectre tiling', creator: `Spectre Lab ${BUILD.version} (build ${BUILD.hash})` });
  }

  function seedLabel() { return S.seed === 'R' ? 'random ancestry ' + S.rseed : SEEDS.find(s => s.id === S.seed).label; }
  function fileBase() { return `spectre-lab-${S.seed === 'R' ? 'random' + S.rseed : S.seed}-${S.depth}steps-${X.area === 'view' ? 'view' : 'patch'}`; }
  function caption() {
    return `Spectre tiling - ${fmt(P.N)} tiles, ${S.depth} substitution steps, seed ${seedLabel()}` + (D.on ? ' - custom tile design' : '') + ` - Spectre Lab v${BUILD.version}`;
  }
  function setXNote(t) { $('xNote').textContent = t; }
  function syncExport() {
    if (!P || !W) return;
    press($('xArea'), X.area); press($('xFormat'), X.format); press($('xSize'), X.size); press($('xPage'), X.page);
    $('xSizeRow').hidden = X.format !== 'png'; $('xPageRow').hidden = X.format !== 'pdf';
    $('xTransRow').hidden = X.format !== 'png';
    $('xOverlays').checked = X.overlays; $('xTrans').checked = X.transparent;
    $('xGo').textContent = X.format === 'png' ? 'Save PNG' : 'Save PDF';
    if (X.busy) return;
    if (X.format === 'png') {
      const pl = exportPlan(X.size);
      setXNote(`${fmt(Math.round(pl.w * pl.dpr))} × ${fmt(Math.round(pl.h * pl.dpr))} px`);
    } else {
      const aspect = X.area === 'view' ? W / H : (P.box[2] - P.box[0]) / (P.box[3] - P.box[1]);
      setXNote(`${PAGES[X.page].label} ${aspect > 1 ? 'landscape' : 'portrait'}, about ${PDF_DPI} dpi`);
    }
  }
  async function doExport() {
    if (X.busy || !P) return;
    X.busy = true; $('xGo').disabled = true; setXNote('Rendering…');
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    try {
      if (X.format === 'png') {
        const c = renderExport(X.size, X.transparent ? null : PAL.stage);
        const raw = new Uint8Array(await (await toBlob(c, 'image/png')).arrayBuffer());
        const png = FileFormats.addPngText(raw, { Title: 'Spectre tiling', Description: caption(), Software: `Spectre Lab ${BUILD.version} (build ${BUILD.hash}, ${BUILD.date})` });
        await offer(fileBase() + '.png', new Blob([png], { type: 'image/png' }), c);
      } else {
        const c = renderExport(pdfLongEdge(), X.area === 'patch' ? '#ffffff' : PAL.stage);
        const jpg = new Uint8Array(await (await toBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
        const pdf = buildPdf(jpg, c.width, c.height, X.page, caption());
        await offer(fileBase() + '.pdf', new Blob([pdf], { type: 'application/pdf' }), c);
      }
    } catch (e) {
      X.busy = false; syncExport();
      setXNote(e && e.message === 'too-large' ? 'That size is too large for this device. Choose a smaller one.' : 'The export did not work. Try a smaller size.');
    } finally { X.busy = false; $('xGo').disabled = false; }
  }
  async function offer(name, blob, canvas) {
    if (downloadsApi) {
      try { await downloadsApi.save({ filename: name, data: blob }); setXNote('Saved ' + name); return; }
      catch (e) {
        const code = e && e.code;
        if (code === 'declined') { setXNote('Save cancelled'); return; }
        if (code === 'rate_limited') { setXNote('A save prompt is already open'); return; }
        if (code === 'too_large') { setXNote('That file is too large to save here. Choose a smaller size.'); return; }
      }
    }
    // no save prompt in this view: show the picture so it can be saved from the browser
    const png = name.endsWith('.png') ? blob : await toBlob(canvas, 'image/png');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(png);
    $('xpImg').src = previewUrl;
    $('xpMsg').textContent = (name.endsWith('.pdf') ? 'This view cannot offer a PDF to save, so here is the same picture as a PNG. ' : 'This view cannot offer a file to save. ')
      + 'Right-click or long-press the picture to save it, or open Spectre Lab in claude.ai to save files directly.';
    $('xPreview').hidden = false; $('xpClose').focus();
    setXNote('Shown below as a picture');
  }
  function closePreview() {
    $('xPreview').hidden = true; $('xpImg').removeAttribute('src');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  }
  seg($('xArea'), [{ v: 'view', label: 'Current view' }, { v: 'patch', label: 'Whole patch' }], v => { X.area = v; syncExport(); });
  seg($('xFormat'), [{ v: 'png', label: 'PNG' }, { v: 'pdf', label: 'PDF' }], v => { X.format = v; syncExport(); });
  seg($('xSize'), [2000, 4000, 8000].map(n => ({ v: n, label: fmt(n) + ' px' })), v => { X.size = +v; syncExport(); });
  seg($('xPage'), Object.keys(PAGES).map(k => ({ v: k, label: PAGES[k].label })), v => { X.page = v; syncExport(); });
  $('xOverlays').addEventListener('change', e => { X.overlays = e.target.checked; });
  $('xTrans').addEventListener('change', e => { X.transparent = e.target.checked; });
  $('xGo').addEventListener('click', doExport);
  $('xpClose').addEventListener('click', closePreview);
  $('xPreview').addEventListener('click', e => { if (e.target.id === 'xPreview') closePreview(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('xPreview').hidden) closePreview(); });
  $('launchExport').addEventListener('click', () => {
    const sec = $('h-export').parentElement;
    sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('xGo').focus({ preventScroll: true });
  });

  // ---------- view ----------
  function fit(frac) {
    const [x0, y0, x1, y1] = P.box, bw = x1 - x0, bh = y1 - y0;
    V.s = Math.min(W / bw, H / bh) * 0.92 / (frac || 1);
    V.ox = W / 2 - (x0 + x1) / 2 * V.s; V.oy = H / 2 + (y0 + y1) / 2 * V.s;
    request();
  }
  function zoomAt(x, y, f) {
    const s = Math.max(0.4, Math.min(420, V.s * f)), g = s / V.s;
    V.ox = x - (x - V.ox) * g; V.oy = y - (y - V.oy) * g; V.s = s; request();
  }
  // Start on the innermost core (the depth-1 patch, which every deeper patch contains).
  function initialView() {
    const [cx, cy] = CORE;
    V.s = Math.max(6, Math.min(13, Math.min(W, H) / 60));
    V.ox = W / 2 - cx * V.s; V.oy = H / 2 + cy * V.s; request();
  }
  function centreOn(i) { V.ox = W / 2 - P.cen[i * 2] * V.s; V.oy = H / 2 + P.cen[i * 2 + 1] * V.s; request(); }
  function ensureVisible(i) {
    const x = sx(P.cen[i * 2]), y = sy(P.cen[i * 2 + 1]), m = 50;
    if (x < m || x > W - m || y < m || y > H - m) centreOn(i);
  }
  function nearestToCentre() {
    const wx = (W / 2 - V.ox) / V.s, wy = -(H / 2 - V.oy) / V.s;
    let best = -1, bd = 1e18;
    for (let i = 0; i < P.N; i++) { const dx = P.cen[i * 2] - wx, dy = P.cen[i * 2 + 1] - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function pick(x, y) {
    const wx = (x - V.ox) / V.s, wy = -(y - V.oy) / V.s, xy = P.xy, bb = P.bbox;
    for (let i = 0; i < P.N; i++) {
      const b = i * 4;
      if (wx < bb[b] || wx > bb[b + 2] || wy < bb[b + 1] || wy > bb[b + 3]) continue;
      let inside = false; const o = i * 28;
      for (let a = 0, c = 13; a < 14; c = a++) {
        const xa = xy[o + a * 2], ya = xy[o + a * 2 + 1], xc = xy[o + c * 2], yc = xy[o + c * 2 + 1];
        if ((ya > wy) !== (yc > wy) && wx < (xc - xa) * (wy - ya) / (yc - ya) + xa) inside = !inside;
      }
      if (inside) return i;
    }
    return -1;
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    if (W && H) { V.ox += (r.width - W) / 2; V.oy += (r.height - H) / 2; }
    W = r.width; H = r.height;
    if (P) syncExport();
    cv.width = Math.max(1, Math.round(W * DPR)); cv.height = Math.max(1, Math.round(H * DPR));
    request();
  }

  // ---------- pointer interaction ----------
  const ptrs = new Map(); let tap = null, pinch = null;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const p = local(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) tap = { x: p.x, y: p.y, moved: false };
    else { tap = null; pinch = null; }
    cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = local(e), q = ptrs.get(e.pointerId);
    if (ptrs.size === 1) {
      V.ox += p.x - q.x; V.oy += p.y - q.y;
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) tap.moved = true;
      ptrs.set(e.pointerId, p); request();
    } else if (ptrs.size === 2) {
      ptrs.set(e.pointerId, p);
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch) { V.ox += m.x - pinch.m.x; V.oy += m.y - pinch.m.y; zoomAt(m.x, m.y, d / pinch.d); }
      pinch = { d: Math.max(1, d), m };
    }
  });
  function endPtr(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (e.type === 'pointerup' && ptrs.size === 0 && tap && !tap.moved) {
      const p = local(e), i = pick(p.x, p.y);
      if (i >= 0) select(i);
    }
    if (ptrs.size === 0) { tap = null; cv.classList.remove('dragging'); }
    else tap = null;
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e), k = e.deltaMode === 1 ? 0.05 : 0.0018;
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * k));
  }, { passive: false });
  $('zIn').addEventListener('click', () => zoomAt(W / 2, H / 2, 1.5));
  $('zOut').addEventListener('click', () => zoomAt(W / 2, H / 2, 1 / 1.5));
  $('zFit').addEventListener('click', () => fit(1));

  // ---------- coordinates ----------
  function cells(i) {
    const node = P.tiles.node[i], isG = P.nodes.type[node] === 'G', out = [];
    out.push({ kind: 'tile', d: String(P.tiles.sub[i]), t: '', node: -1, order: 0, dim: !isG });
    for (let v = node; v >= 0; v = P.nodes.parent[v]) {
      const t = P.nodes.type[v], ts = P.nodes.tslot[v], root = P.nodes.parent[v] < 0;
      out.push({ kind: root ? 'root' : 'hex', d: root ? t : String(ts), t, node: v, order: P.nodes.order[v] });
    }
    return out;
  }
  function readingText(cs) {
    const hex = cs.slice(1);
    let s = cs[0].dim ? `The only Spectre of ${ART[hex[0].t]} <b>${hex[0].t}</b> hexagon`
      : `Spectre ${cs[0].d} of a <b>G</b> hexagon${cs[0].d === '1' ? ' (the half turned by 30°)' : ''}`;
    for (let k = 0; k < hex.length - 1; k++) s += `, which is child ${hex[k].d} of ${ART[hex[k + 1].t]} <b>${hex[k + 1].t}</b>`;
    return s + ', the root of this patch.';
  }

  function select(i, keepStep) {
    S.sel = i; hoverEdge = -1; pinNode = -1;
    if (!keepStep) { lastStep = null; cameEdge = -1; }
    renderInspector(-1); request();
  }
  function walk(e) {
    let i = S.sel;
    if (i < 0) return;
    if (P.nbT[i * 14 + e] < 0) {
      if (S.depth >= MAXD) return;
      busy(() => {
        while (S.depth < MAXD && P.nbT[S.sel * 14 + e] < 0) setDepth(S.depth + 1, true);
        if (P.nbT[S.sel * 14 + e] >= 0) step(e); else { renderAll(); }
      });
      return;
    }
    step(e);
  }
  function step(e) {
    const i = S.sel, before = cells(i), j = P.nbT[i * 14 + e], ej = P.nbE[i * 14 + e];
    const after = cells(j);
    let h = -1;
    for (let p = after.length - 1; p >= 0; p--) if (before[p].d !== after[p].d || before[p].t !== after[p].t) { h = p; break; }
    lastStep = { out: C.tEdge(e), into: C.tEdge(ej), changed: h + 1, total: after.length };
    cameEdge = ej; S.sel = j; hoverEdge = -1; pinNode = -1;
    renderInspector(h); ensureVisible(j); request();
    const btn = document.querySelector(`.edge[data-e="${e}"]`);
    if (btn && document.activeElement && document.activeElement.classList.contains('edge')) btn.focus();
  }

  function renderInspector(flashUpTo) {
    const el = $('inspector');
    if (S.sel < 0 || !P) { el.innerHTML = '<p class="empty">Tap any Spectre on the tiling to read its coordinates.</p>'; return; }
    const i = S.sel, cs = cells(i), T = P.tiles.T[i];
    let h = '<div class="coordhead"><span>this Spectre</span><span>root</span></div><div class="coords">';
    cs.forEach((c, p) => {
      const fl = p <= flashUpTo ? ' flash' : '';
      if (c.kind === 'tile') {
        h += `<button type="button" class="cell${c.dim ? ' dim' : ''}${fl}" data-node="-1" title="${c.dim ? 'Only Spectre of its hexagon' : 'Spectre ' + c.d + ' of its G hexagon'}"><span class="o">tile</span><span class="d">${c.d}</span><span class="t">${c.dim ? 'only' : 'of G'}</span></button>`;
      } else {
        const g = C.GREEK[c.t], title = c.kind === 'root' ? `Root: ${ORD(c.order)}-order ${c.t} (${g}) hexagon` : `${ORD(c.order)}-order ${c.t} (${g}) hexagon, child ${c.d} of its parent`;
        h += `<button type="button" class="cell${c.kind === 'root' ? ' root' : ''}${fl}" data-node="${c.node}" style="--sw:var(--t-${c.t})" title="${title}" aria-pressed="false"><span class="o">${ORD(c.order)}</span><span class="d">${c.d}</span><span class="t"><i></i>${c.kind === 'root' ? 'root' : c.t}</span></button>`;
      }
    });
    h += '</div>';
    h += `<p class="reading">${readingText(cs)}</p>`;
    const [x, y] = C.toXY(T.t), odd = T.k % 2 === 1;
    const nb = new Set(); let rim = 0;
    for (let e = 0; e < 14; e++) { const j = P.nbT[i * 14 + e]; if (j >= 0) nb.add(j); else rim++; }
    h += '<dl class="facts">';
    h += `<dt>Rotation</dt><dd>${T.k * 30}° <small>${odd ? 'odd multiple of 30°: a turned G half' : 'even multiple of 30°'}</small></dd>`;
    h += `<dt>Anchor vertex</dt><dd>(${T.t.map(minus).join(', ')}) <small>in 1, d, d², d³</small></dd>`;
    h += `<dt>In the plane</dt><dd>x ${minus(+x.toFixed(3))}, y ${minus(+y.toFixed(3))}</dd>`;
    h += `<dt>Neighbours</dt><dd>${nb.size} Spectres <small>across 14 edges${rim ? `, ${rim} on the patch rim` : ''}</small></dd>`;
    h += '</dl>';
    const stepTxt = lastStep ? `out ${lastStep.out} → in ${lastStep.into} · rewrote ${lastStep.changed} of ${lastStep.total}` : '';
    h += `<div class="walk"><div class="walkhead"><span class="lbl">Walk across an edge (Tatham's numbering)</span><span class="step" aria-live="polite">${stepTxt}</span></div><div class="edges">`;
    for (let t = 0; t < 14; t++) {
      const e = C.mEdge(t), j = P.nbT[i * 14 + e];
      let to, cls = 'edge', dis = '', title;
      if (j >= 0) {
        const ty = P.nodes.type[P.tiles.node[j]], ej = C.tEdge(P.nbE[i * 14 + e]);
        to = `${ty}·${ej}`; title = `Edge ${t} meets edge ${ej} of a Spectre in ${ART[ty]} ${ty} hexagon`;
      } else if (S.depth < MAXD) { to = 'grow'; cls += ' grow'; title = `Edge ${t} is on the patch rim; walking here adds substitution steps`; }
      else { to = 'rim'; dis = ' disabled'; title = `Edge ${t} is on the rim of the largest patch`; }
      if (e === cameEdge) cls += ' came';
      h += `<button type="button" class="${cls}" data-e="${e}" title="${title}"${dis}><span class="n">${t}</span><span class="to">${to}</span></button>`;
    }
    h += '</div></div>';
    h += '<div class="inline"><button type="button" class="btn" id="centreBtn">Focus on this Spectre</button><button type="button" class="btn" id="designBtn">Design this tile</button></div>';
    el.innerHTML = h;
  }
  const insp = $('inspector');
  insp.addEventListener('mouseover', e => {
    const c = e.target.closest('.cell'); if (c) { const v = +c.dataset.node; if (v !== hoverNode) { hoverNode = v; request(); } }
    const b = e.target.closest('.edge'); if (b && !b.disabled) { const v = +b.dataset.e; if (v !== hoverEdge) { hoverEdge = v; request(); } }
  });
  insp.addEventListener('mouseout', e => {
    if (e.target.closest('.cell') && hoverNode !== -1) { hoverNode = -1; request(); }
    if (e.target.closest('.edge') && hoverEdge !== -1) { hoverEdge = -1; request(); }
  });
  insp.addEventListener('focusin', e => {
    const b = e.target.closest('.edge'); if (b) { hoverEdge = +b.dataset.e; request(); }
  });
  insp.addEventListener('click', e => {
    const c = e.target.closest('.cell');
    if (c) {
      const v = +c.dataset.node;
      pinNode = (pinNode === v || v < 0) ? -1 : v;
      insp.querySelectorAll('.cell').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.node === pinNode && pinNode >= 0)));
      request(); return;
    }
    const b = e.target.closest('.edge'); if (b && !b.disabled) { walk(+b.dataset.e); return; }
    if (e.target.id === 'centreBtn' && S.sel >= 0) focusOn(S.sel);
    if (e.target.id === 'designBtn' && S.sel >= 0) openStudio(D.ownG && P.tiles.sub[S.sel] === 1 ? 1 : 0);
  });

  // ---------- census ----------
  function renderCensus() {
    const tb = $('census'), note = $('censusNote'), title = $('h-census');
    let h = '';
    const g1 = P.tiles.sub.reduce((a, s) => a + s, 0);
    if (S.colour === 'type') {
      const k = Math.min(S.torder, P.n + 1), list = P.byOrder[k] || [];
      const cnt = {}; TYPES.forEach(t => cnt[t] = 0); list.forEach(v => cnt[P.nodes.type[v]]++);
      title.textContent = `Census · ${ORD(k)}-order hexagons`;
      h = '<thead><tr><th>Hexagon</th><th class="r">Count</th><th class="r">Share</th><th class="r">Limit</th></tr></thead><tbody>';
      for (const t of TYPES) {
        h += `<tr><td><span class="sw" style="background:var(--t-${t})"></span>${t}<span class="gk">${C.GREEK[t]} ${C.GREEK_NAME[t]}</span></td><td class="r">${fmt(cnt[t])}</td><td class="r">${(100 * cnt[t] / list.length).toFixed(1)}%</td><td class="r">${(100 * C.FREQ[t]).toFixed(1)}%</td></tr>`;
      }
      h += '</tbody>';
      note.innerHTML = k === 1
        ? `Limit is the long-run share of each type. The darker red tiles are the turned halves of the G hexagons: <b>${fmt(g1)}</b> of ${fmt(P.N)} Spectres.`
        : `Limit is the long-run share of each type. Every Spectre takes the colour of the ${ORD(k)}-order hexagon around it.`;
    } else if (S.colour === 'four') {
      const col = fourCol(), c = [0, 0, 0, 0]; col.forEach(x => c[x]++);
      title.textContent = 'Census · four-colouring';
      const names = ['First hexagon colour', 'Second hexagon colour', 'Third hexagon colour', 'Turned G halves'];
      h = '<thead><tr><th>Colour</th><th class="r">Spectres</th><th class="r">Share</th></tr></thead><tbody>';
      names.forEach((n, i) => { h += `<tr><td><span class="sw" style="background:var(--c4-${i})"></span>${n}</td><td class="r">${fmt(c[i])}</td><td class="r">${(100 * c[i] / P.N).toFixed(1)}%</td></tr>`; });
      h += '</tbody>';
      note.innerHTML = 'The 1st-order hexagons form a hexagonal grid, so three colours alternate around each one. The turned G halves never touch one another, so they share the fourth.';
    } else if (S.colour === 'orient') {
      const c = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < P.N; i++) c[P.tk[i] % 2 ? 6 : P.tk[i] / 2]++;
      title.textContent = 'Census · orientation';
      h = '<thead><tr><th>Rotation</th><th class="r">Spectres</th><th class="r">Share</th></tr></thead><tbody>';
      for (let r = 0; r < 7; r++) {
        const lab = r < 6 ? `${r * 60}°` : 'Odd multiples of 30°';
        h += `<tr><td><span class="sw" style="background:var(--o-${r < 6 ? r : 'odd'})"></span>${lab}</td><td class="r">${fmt(c[r])}</td><td class="r">${(100 * c[r] / P.N).toFixed(1)}%</td></tr>`;
      }
      h += '</tbody>';
      note.innerHTML = 'Every hexagon places its Spectre at a multiple of 60°. Only the second Spectre of a G is turned a further 30°, so the odd rotations mark exactly those tiles.';
    } else {
      title.textContent = 'Census';
      const h1 = (P.byOrder[1] || []).length, gs = (P.byOrder[1] || []).filter(v => P.nodes.type[v] === 'G').length;
      h = '<tbody>';
      [['Spectres', P.N], ['1st-order hexagons', h1], ['G hexagons (two Spectres each)', gs], ['Turned G halves', g1]].forEach(([n, v]) => { h += `<tr><td>${n}</td><td class="r">${fmt(v)}</td></tr>`; });
      h += '</tbody>';
      note.innerHTML = 'All Spectres share one handedness. None of them is a mirror image.';
    }
    tb.innerHTML = h;
  }

  // ---------- controls ----------
  function seg(el, items, onPick) {
    el.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.v = it.v; if (it.title) b.title = it.title;
      b.addEventListener('click', () => onPick(it.v));
      el.appendChild(b);
    }
  }
  const press = (el, val) => { for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(val))); };
  const SIZES = ['', '9', '71', 'about 560', 'about 4,400', 'about 35,000'];
  seg($('depthSeg'), [1, 2, 3, 4, 5].map(n => ({ v: n, label: String(n), title: `${n} substitution step${n > 1 ? 's' : ''}: ${SIZES[n]} Spectres` })),
    v => { if (+v === S.depth) return; busy(() => { setDepth(+v); }); });
  seg($('colourSeg'), [
    { v: 'type', label: 'Hexagon type' }, { v: 'four', label: 'Four colours' },
    { v: 'orient', label: 'Rotation' }, { v: 'plain', label: 'Plain' }
  ], v => { S.colour = v; syncControls(); renderCensus(); request(); });
  const sel = $('seedSel');
  SEEDS.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.label; sel.appendChild(o); });
  sel.addEventListener('change', () => { S.seed = sel.value; busy(newSeed); });
  $('reroll').addEventListener('click', () => { S.rseed = 1 + Math.floor(Math.random() * 99998); S.seed = 'R'; sel.value = 'R'; busy(newSeed); });
  const tog = (id, key, after) => { const el = $(id); el.checked = S[key]; el.addEventListener('change', () => { S[key] = el.checked; if (after) after(); request(); }); };
  tog('tLetters', 'letters'); tog('tCurved', 'curved'); tog('tEdges', 'edgeNums');

  function syncControls() {
    press($('depthSeg'), S.depth);
    press($('colourSeg'), S.colour);
    S.torder = Math.min(S.torder, S.depth + 1);
    S.outline = Math.min(S.outline, S.depth);
    const tos = $('typeOrderSeg');
    seg(tos, Array.from({ length: S.depth + 1 }, (_, k) => ({ v: k + 1, label: String(k + 1), title: `Colour by the ${ORD(k + 1)}-order hexagon` })),
      v => { S.torder = +v; syncControls(); renderCensus(); request(); });
    press(tos, S.torder);
    $('typeOrderRow').hidden = S.colour !== 'type';
    const os = $('outlineSeg');
    seg(os, [{ v: 0, label: 'Off' }].concat(Array.from({ length: S.depth }, (_, k) => ({ v: k + 1, label: String(k + 1), title: `Outline the ${ORD(k + 1)}-order hexagons` }))),
      v => { S.outline = +v; syncControls(); request(); });
    press(os, S.outline);
    sel.value = S.seed;
    const sd = SEEDS.find(s => s.id === S.seed), root = P.nodes.type[0];
    $('caption').innerHTML = `<b>${fmt(P.N)}</b> Spectres · ${S.depth} step${S.depth > 1 ? 's' : ''} · root ${root} · seed ${S.seed === 'R' ? '#' + S.rseed : sd.short}`;
    $('patchNote').innerHTML = `<b>${fmt(P.N)}</b> Spectres inside one ${ORD(S.depth + 1)}-order <b>${root}</b> (${C.GREEK[root]}) hexagon. ` +
      (S.seed === 'R' ? `Ancestry #${S.rseed} is made up one level at a time, weighted by how common each hexagon type is.`
        : `Each extra step wraps the current patch in a larger ${sd.id[0]} hexagon, at child ${sd.id[1]}.`);
  }
  function renderAll() { syncControls(); renderInspector(-1); renderCensus(); syncExport(); request(); }

  function setDepth(n, quiet) {
    const key = S.sel >= 0 ? tileKey(S.sel) : null;
    S.depth = n; build();
    S.sel = key ? findKey(key) : -1;
    if (S.sel < 0) { S.sel = nearestToCentre(); lastStep = null; cameEdge = -1; }
    if (!quiet) renderAll();
  }
  function newSeed() {
    makeChain(); build(); initialView();
    S.sel = nearestToCentre(); lastStep = null; cameEdge = -1;
    renderAll();
  }
  function busy(fn) {
    const b = $('busy'); b.hidden = false;
    requestAnimationFrame(() => setTimeout(() => { try { fn(); } finally { b.hidden = true; } }, 16));
  }

  // ---------- theme ----------
  const onTheme = () => { readPalette(); request(); renderThumbs(); edRequest(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme); } catch (_) {}
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(request);

  // ---------- boot ----------
  function start(data) {
    const saved = data && data.S;
    if (saved) Object.assign(S, saved, { sel: -1 });
    readPalette();
    loadDesign();
    if (data && data.D) ['on', 'placement', 'planeSize', 'tint', 'grout', 'groutColour', 'ownG'].forEach(k => { if (data.D[k] !== undefined) D[k] = data.D[k]; });
    ['tLetters', 'tCurved', 'tEdges'].forEach((id, k) => { $(id).checked = S[['letters', 'curved', 'edgeNums'][k]]; });
    makeChain(); build();
    resize();
    new ResizeObserver(resize).observe(stage);
    if (saved && data.V) Object.assign(V, data.V); else initialView();
    S.sel = nearestToCentre();
    renderAll(); syncDesign(); requestAnimationFrame(renderThumbs);
  }
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ S: Object.assign({}, S), V: Object.assign({}, V), D: { on: D.on, placement: D.placement, planeSize: D.planeSize, tint: D.tint, grout: D.grout, groutColour: D.groutColour, ownG: D.ownG } })); } catch (_) {}
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
