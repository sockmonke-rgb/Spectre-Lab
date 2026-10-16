'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

const D5 = C.fixedChain('D', 1);
const patches = {};
const patch = n => patches[n] || (patches[n] = C.build(D5, n));

test('the Spectre outline closes after its 14 unit edges', () => {
  assert.equal(C.PTS.length, 14);
  const DIRS = [0, 10, 1, 3, 0, 2, 5, 7, 4, 6, 6, 8, 11, 9];
  let z = [0, 0, 0, 0];
  for (const d of DIRS) z = z.map((x, i) => x + C.DV[d][i]);
  assert.deepEqual(z, [0, 0, 0, 0]);
});

test('exact transforms compose and invert', () => {
  const T = { t: [3, -1, 2, 5], k: 7, f: true }, U = { t: [1, 2, -4, 0], k: 4, f: false };
  const z = [2, 5, -3, 1];
  assert.deepEqual(C.apply(C.compose(T, U), z), C.apply(T, C.apply(U, z)));
  assert.deepEqual(C.apply(C.inverse(T), C.apply(T, z)), z);
  assert.deepEqual(C.apply(C.inverse(U), C.apply(U, z)), z);
});

test('patch sizes grow by the substitution', () => {
  assert.deepEqual([1, 2, 3, 4].map(n => patch(n).N), [9, 71, 559, 4401]);
});

test('every Spectre has the same handedness, and only turned G halves sit at odd multiples of 30°', () => {
  const P = patch(4);
  for (let i = 0; i < P.N; i++) {
    assert.equal(P.tf[i], 0);
    assert.equal(P.tk[i] % 2 === 1, P.tiles.sub[i] === 1);
  }
});

test('neighbouring Spectres always meet an odd edge to an even one', () => {
  const P = patch(4);
  for (let i = 0; i < P.N; i++) for (let e = 0; e < 14; e++) {
    const j = P.nbT[i * 14 + e];
    if (j >= 0) assert.notEqual(e % 2, P.nbE[i * 14 + e] % 2);
  }
});

test("edge numbering matches Tatham's: edge 11 of G Spectre 0 meets edge 6 of Spectre 1", () => {
  const P = patch(1);
  const i = P.tiles.node.findIndex((v, k) => P.nodes.type[v] === 'G' && P.tiles.sub[k] === 0);
  const e = C.mEdge(11);
  assert.equal(P.nbT[i * 14 + e], i + 1);
  assert.equal(C.tEdge(P.nbE[i * 14 + e]), 6);
});

test("child numbers match Tatham's hexagon layout", () => {
  const expected = new Set(['0-1', '0-2', '0-3', '1-3', '2-3', '2-4', '2-5', '3-6', '4-5', '5-6', '5-7', '6-7']);
  const P = patch(4), a1 = P.anc[1], a2 = P.anc[2], found = new Set();
  for (let i = 0; i < P.N; i++) for (let e = 0; e < 14; e++) {
    const j = P.nbT[i * 14 + e];
    if (j < 0 || a2[i] !== a2[j] || a1[i] === a1[j]) continue;
    const u = P.nodes.tslot[a1[i]], v = P.nodes.tslot[a1[j]];
    found.add(Math.min(u, v) + '-' + Math.max(u, v));
  }
  // S (3) and D (5) are neighbouring hexagons but share no Spectre edge: the S hexagon's spur.
  assert.deepEqual([...found].sort(), [...expected].sort());
});

test('the four-colouring is proper for every seed', () => {
  for (const [type, slot] of [['D', 1], ['G', 7], ['S', 4], ['F', 3], ['Y', 5]]) {
    const P = C.build(C.fixedChain(type, slot), 3), col = C.fourColour(P);
    for (let i = 0; i < P.N; i++) for (let e = 0; e < 14; e++) {
      const j = P.nbT[i * 14 + e];
      if (j >= 0) assert.notEqual(col[i], col[j], `seed ${type}`);
    }
  }
});

test('each patch sits exactly inside the next one', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const chain of [D5, C.fixedChain('Y', 0), C.randomChain(rng)]) {
    const A = C.build(chain, 3), B = C.build(chain, 4);
    const key = (P, i) => P.tiles.T[i].t.join(',') + '/' + P.tiles.T[i].k;
    const inB = new Set(); for (let i = 0; i < B.N; i++) inB.add(key(B, i));
    for (let i = 0; i < A.N; i++) assert.ok(inB.has(key(A, i)));
  }
});

test('limiting frequencies sum to one', () => {
  const total = Object.values(C.FREQ).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(Math.abs(C.FREQ.F - 0.2218) < 1e-3);
});
