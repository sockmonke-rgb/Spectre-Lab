// Spectre engine: exact arithmetic in Z[d], d = e^{i*pi/6} (Tatham's appendix),
// nine-hexagon substitution (Smith, Myers, Kaplan, Goodman-Strauss 2023),
// hexagon letters and child numbering after Tatham.
const SpectreCore = (function () {
  'use strict';
  const S3 = Math.sqrt(3) / 2;
  // d^k for k = 0..11 as coefficients of 1, d, d^2, d^3   (d^4 = d^2 - 1)
  const DV = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[-1,0,1,0],[0,-1,0,1],
              [-1,0,0,0],[0,-1,0,0],[0,0,-1,0],[0,0,0,-1],[1,0,-1,0],[0,1,0,-1]];
  const Z = [0,0,0,0];
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2], a[3]+b[3]];
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2], a[3]-b[3]];
  const neg = a => [-a[0], -a[1], -a[2], -a[3]];
  const mulD = a => [-a[3], a[0], a[1]+a[3], a[2]];
  function mulDk(a, k) { k = ((k % 12) + 12) % 12; for (let i = 0; i < k; i++) a = mulD(a); return a; }
  // F(z) = -conj(z): reflection in the imaginary axis (x -> -x)
  const Fz = a => [-a[0]-a[2], -a[1], a[2], a[1]+a[3]];
  const toXY = a => [a[0] + S3*a[1] + a[2]/2, a[3] + S3*a[2] + a[1]/2];

  // Transform: z -> t + d^k * (f ? F(z) : z)
  const ID = { t: Z, k: 0, f: false };
  const REFL = { t: Z, k: 0, f: true };
  const md = k => ((k % 12) + 12) % 12;
  const apply = (T, z) => add(T.t, mulDk(T.f ? Fz(z) : z, T.k));
  const compose = (A, B) => ({
    t: add(A.t, mulDk(A.f ? Fz(B.t) : B.t, A.k)),
    k: md(A.f ? A.k - B.k : A.k + B.k),
    f: A.f !== B.f
  });
  const inverse = T => T.f ? { t: neg(mulDk(Fz(T.t), T.k)), k: T.k, f: true }
                           : { t: neg(mulDk(T.t, -T.k)), k: md(-T.k), f: false };
  const trans = v => ({ t: v, k: 0, f: false });
  const rot = k => ({ t: Z, k: md(k), f: false });

  // Spectre outline: 14 unit edges (the long edge counts as two), directions in 30° steps.
  const DIRS = [0,10,1,3,0,2,5,7,4,6,6,8,11,9];
  const P = [Z];
  for (let i = 0; i < 14; i++) P.push(add(P[i], DV[DIRS[i]]));
  // P[14] must be back at the origin
  const PTS = P.slice(0, 14);

  // Nine hexagon types. Tatham's Latin letters, paper's Greek letters.
  const TYPES = ['G','D','J','L','X','P','S','F','Y'];
  const GREEK = { G:'Γ', D:'Δ', J:'Θ', L:'Λ', X:'Ξ', P:'Π', S:'Σ', F:'Φ', Y:'Ψ' };
  const GREEK_NAME = { G:'Gamma', D:'Delta', J:'Theta', L:'Lambda', X:'Xi', P:'Pi', S:'Sigma', F:'Phi', Y:'Psi' };
  // Substitution rules in construction-slot order (each slot attached to the previous one).
  const RULES = {
    G: ['P','D',null,'J','S','X','F','G'],
    D: ['X','D','X','F','S','P','F','G'],
    J: ['Y','D','P','F','S','P','F','G'],
    L: ['Y','D','X','F','S','P','F','G'],
    X: ['Y','D','P','F','S','Y','F','G'],
    P: ['Y','D','X','F','S','Y','F','G'],
    S: ['X','D','X','F','S','P','L','G'],
    F: ['Y','D','Y','F','S','P','F','G'],
    Y: ['Y','D','Y','F','S','Y','F','G']
  };
  // construction slot -> Tatham's child number (0..7, 7 absent in G)
  const SLOT_TO_T = [4,5,7,6,3,1,0,2];
  const T_TO_SLOT = []; SLOT_TO_T.forEach((t, s) => { T_TO_SLOT[t] = s; });

  // Order-1 hexagon -> Spectre(s). G holds a second Spectre turned by 30°.
  const G1 = compose(trans(PTS[8]), rot(1));

  // Per-level placement transforms (depend on the quad of the level below).
  const levelTrs = [null];
  let quad = [PTS[3], PTS[5], PTS[7], PTS[11]];
  function buildLevel() {
    const rules = [[2,3,1],[0,2,0],[2,3,1],[2,3,1],[0,2,0],[2,3,1],[-4,3,3]];
    const trs = [ID];
    let total = 0, R = ID, tq = quad;
    for (const [ang, from, to] of rules) {
      if (ang !== 0) { total += ang; R = rot(total); tq = quad.map(q => apply(R, q)); }
      const prev = apply(trs[trs.length - 1], quad[from]);
      trs.push(compose(trans(sub(prev, tq[to])), R));
    }
    const out = trs.map(T => compose(REFL, T));
    quad = [apply(out[6], quad[2]), apply(out[5], quad[1]), apply(out[3], quad[2]), apply(out[0], quad[1])];
    levelTrs.push(out);
  }
  function ensureLevels(n) { while (levelTrs.length <= n) buildLevel(); }

  // Limiting frequencies of the nine hex types (Perron vector of the substitution).
  const FREQ = (function () {
    let v = {}; TYPES.forEach(t => v[t] = 1);
    for (let it = 0; it < 200; it++) {
      const w = {}; TYPES.forEach(t => w[t] = 0);
      for (const p of TYPES) for (const c of RULES[p]) if (c) w[c] += v[p];
      let s = 0; TYPES.forEach(t => s += w[t]);
      TYPES.forEach(t => w[t] /= s); v = w;
    }
    return v;
  })();

  // A seed is an upward chain: chain[L] = {type, slot}, where slot is the construction slot
  // that the level-(L-1) root occupies inside the level-L root.
  function fixedChain(type, slot) {
    return { kind: 'fixed', type, slot, at(L) { return { type, slot }; } };
  }
  // Random upward chain, made up as needed from the limiting frequencies (Tatham's lazy coordinates).
  const PARENTS = {}; TYPES.forEach(t => PARENTS[t] = []);
  for (const p of TYPES) RULES[p].forEach((c, s) => { if (c) PARENTS[c].push({ type: p, slot: s, w: FREQ[p] }); });
  function randomChain(rng) {
    const types = [TYPES[Math.floor(rng() * 9)]], slots = [-1];
    return {
      kind: 'random',
      at(L) {
        while (types.length <= L) {
          const o = PARENTS[types[types.length - 1]]; let tot = 0; o.forEach(x => tot += x.w);
          let r = rng() * tot, pick = o[o.length - 1];
          for (const x of o) { r -= x.w; if (r <= 0) { pick = x; break; } }
          types.push(pick.type); slots.push(pick.slot);
        }
        return { type: types[L], slot: slots[L] };
      }
    };
  }
  const rootType = (chain, L) => chain.at(L).type;

  // Placement of the level-n root so that each depth's patch sits exactly inside the next one.
  function rootPlacement(chain, n) {
    ensureLevels(n);
    let G = REFL; // G_1 (reflection keeps every Spectre in the base handedness)
    for (let L = 2; L <= n; L++) {
      const s = chain.at(L).slot;
      G = compose(G, inverse(levelTrs[L][s]));
    }
    return G;
  }

  // Build the patch for depth n (root at construction level n = hexagon of order n+1).
  function build(chain, n) {
    ensureLevels(n);
    const nodes = { type: [], order: [], parent: [], tslot: [], start: [], end: [] };
    const tiles = { T: [], node: [], sub: [] };
    function rec(type, L, M, parent, slot) {
      const id = nodes.type.length;
      nodes.type.push(type); nodes.order.push(L + 1); nodes.parent.push(parent);
      nodes.tslot.push(slot < 0 ? -1 : SLOT_TO_T[slot]);
      nodes.start.push(tiles.T.length); nodes.end.push(0);
      if (L === 0) {
        tiles.T.push(M); tiles.node.push(id); tiles.sub.push(0);
        if (type === 'G') { tiles.T.push(compose(M, G1)); tiles.node.push(id); tiles.sub.push(1); }
      } else {
        const r = RULES[type], trs = levelTrs[L];
        for (let s = 0; s < 8; s++) if (r[s]) rec(r[s], L - 1, compose(M, trs[s]), id, s);
      }
      nodes.end[id] = tiles.T.length;
    }
    rec(rootType(chain, n), n, rootPlacement(chain, n), -1, -1);
    return finish(nodes, tiles, n);
  }

  // Precomputed float outlines for the 24 orientations
  const BASEF = [];
  for (let f = 0; f < 2; f++) for (let k = 0; k < 12; k++) {
    const T = { t: Z, k, f: !!f };
    BASEF[f * 12 + k] = PTS.map(p => toXY(apply(T, p)));
  }

  function finish(nodes, tiles, n) {
    const N = tiles.T.length;
    const xy = new Float64Array(N * 28);
    const tk = new Uint8Array(N), tf = new Uint8Array(N);
    const bbox = new Float64Array(N * 4), cen = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      const T = tiles.T[i], [ox, oy] = toXY(T.t), base = BASEF[(T.f ? 12 : 0) + T.k];
      tk[i] = T.k; tf[i] = T.f ? 1 : 0;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
      for (let j = 0; j < 14; j++) {
        const x = ox + base[j][0], y = oy + base[j][1];
        xy[i*28 + j*2] = x; xy[i*28 + j*2 + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        cx += x; cy += y;
      }
      bbox[i*4] = x0; bbox[i*4+1] = y0; bbox[i*4+2] = x1; bbox[i*4+3] = y1;
      cen[i*2] = cx / 14; cen[i*2+1] = cy / 14;
    }
    // ancestors: anc[m][i] = node id of the order-m hexagon containing tile i (m = 1..n+1)
    const anc = [null];
    const a1 = new Int32Array(N); for (let i = 0; i < N; i++) a1[i] = tiles.node[i];
    anc.push(a1);
    for (let m = 2; m <= n + 1; m++) {
      const prev = anc[m - 1], a = new Int32Array(N);
      for (let i = 0; i < N; i++) a[i] = nodes.parent[prev[i]];
      anc.push(a);
    }
    // adjacency through shared unit edges, keyed by the edge midpoint
    const nbT = new Int32Array(N * 14).fill(-1), nbE = new Int8Array(N * 14).fill(-1);
    const map = new Map();
    for (let i = 0; i < N; i++) for (let e = 0; e < 14; e++) {
      const j0 = e, j1 = (e + 1) % 14;
      const mx = (xy[i*28 + j0*2] + xy[i*28 + j1*2]) / 2, my = (xy[i*28 + j0*2 + 1] + xy[i*28 + j1*2 + 1]) / 2;
      const key = (Math.round(mx * 256) + 8388608) * 16777216 + (Math.round(my * 256) + 8388608);
      const o = map.get(key);
      if (o === undefined) map.set(key, i * 14 + e);
      else { const ti = (o / 14) | 0, te = o % 14; nbT[i*14+e] = ti; nbE[i*14+e] = te; nbT[o] = i; nbE[o] = e; }
    }
    // node bboxes/centroids
    const NN = nodes.type.length;
    const nb = new Float64Array(NN * 4), nc = new Float64Array(NN * 2);
    for (let v = 0; v < NN; v++) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
      const s = nodes.start[v], e = nodes.end[v];
      for (let i = s; i < e; i++) {
        if (bbox[i*4] < x0) x0 = bbox[i*4]; if (bbox[i*4+1] < y0) y0 = bbox[i*4+1];
        if (bbox[i*4+2] > x1) x1 = bbox[i*4+2]; if (bbox[i*4+3] > y1) y1 = bbox[i*4+3];
        cx += cen[i*2]; cy += cen[i*2+1];
      }
      nb[v*4] = x0; nb[v*4+1] = y0; nb[v*4+2] = x1; nb[v*4+3] = y1;
      nc[v*2] = cx / (e - s); nc[v*2+1] = cy / (e - s);
    }
    return { n, N, nodes, tiles, xy, tk, tf, bbox, cen, anc, nbT, nbE, nodeBox: nb, nodeCen: nc };
  }

  // Tatham-style numbering of Spectre edges (his figure runs the other way round the outline).
  const tEdge = m => (5 - m + 14) % 14;
  const mEdge = t => (5 - t + 14) % 14;

  // Proper 3-colouring of order-1 hexagons, then G1 Spectres take a fourth colour.
  function fourColour(P) {
    const N = P.N, a1 = P.anc[1], NN = P.nodes.type.length;
    const adj = new Map();
    const link = (u, v) => { if (!adj.has(u)) adj.set(u, new Set()); adj.get(u).add(v); };
    const order = []; const seen = new Set();
    for (let i = 0; i < N; i++) {
      const u = a1[i]; if (!seen.has(u)) { seen.add(u); order.push(u); }
      for (let e = 0; e < 14; e++) {
        const j = P.nbT[i*14+e]; if (j < 0) continue;
        const v = a1[j]; if (v !== u) { link(u, v); link(v, u); }
      }
    }
    // The S hexagon's spur means S and its sibling D (children 3 and 5) are neighbours as
    // hexagons without sharing a Spectre edge. Add that hexagon adjacency explicitly.
    const kids = new Map();
    for (const u of order) {
      const p = P.nodes.parent[u], t = P.nodes.tslot[u];
      if (p < 0 || (t !== 3 && t !== 5)) continue;
      if (!kids.has(p)) kids.set(p, {}); kids.get(p)[t] = u;
    }
    for (const k of kids.values()) if (k[3] !== undefined && k[5] !== undefined) { link(k[3], k[5]); link(k[5], k[3]); }
    const col = new Map();
    // seed: the order-1 hex holding the origin-most tile of the depth-1 core (first in DFS of the nested core)
    let seed = order[0];
    let best = 1e18;
    for (const u of order) { const x = P.nodeCen[u*2], y = P.nodeCen[u*2+1], d = x*x + y*y; if (d < best) { best = d; seed = u; } }
    col.set(seed, 0);
    const nbrs = u => adj.get(u) || new Set();
    // first neighbour: the one across the lowest edge number of the seed's first tile
    let second = -1;
    { const i = P.nodes.start[seed];
      for (let e = 0; e < 14 && second < 0; e++) { const j = P.nbT[i*14+e]; if (j >= 0 && a1[j] !== seed) second = a1[j]; } }
    if (second >= 0) col.set(second, 1);
    const queue = [seed, second].filter(x => x >= 0);
    while (queue.length) {
      const u = queue.shift(); const cu = col.get(u);
      for (const v of nbrs(u)) {
        if (!col.has(v)) continue; const cv = col.get(v);
        if (cv === cu) continue;
        for (const w of nbrs(u)) {
          if (col.has(w) || !nbrs(v).has(w)) continue;
          col.set(w, 3 - cu - cv); queue.push(w);
        }
      }
    }
    // stragglers at the patch boundary
    let changed = true;
    while (changed) {
      changed = false;
      for (const u of order) {
        if (col.has(u)) continue;
        const used = new Set(); for (const v of nbrs(u)) if (col.has(v)) used.add(col.get(v));
        let c = 0; while (used.has(c) && c < 2) c++;
        col.set(u, c); changed = true;
      }
    }
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) out[i] = P.tiles.sub[i] === 1 ? 3 : col.get(a1[i]);
    return out;
  }

  return { DV, PTS, TYPES, GREEK, GREEK_NAME, RULES, SLOT_TO_T, T_TO_SLOT, FREQ, toXY, apply, compose, inverse,
           fixedChain, randomChain, rootType, build, tEdge, mEdge, fourColour, levelTrs, ensureLevels, ID, REFL };
})();
if (typeof module !== 'undefined') module.exports = SpectreCore;
