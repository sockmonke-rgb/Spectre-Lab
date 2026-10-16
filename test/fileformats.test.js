'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const F = require('../src/fileformats.js');

const latin1 = u => Buffer.from(u).toString('latin1');

test('crc32 matches the PNG reference value', () => {
  assert.equal(F.crc32(Buffer.from('IEND')), 0xae426082);
});

function tinyPng() {
  const chunk = (type, data) => {
    const c = Buffer.alloc(12 + data.length);
    c.writeUInt32BE(data.length, 0); c.write(type, 4, 'latin1'); data.copy(c, 8);
    c.writeUInt32BE(F.crc32(c.subarray(4, 8 + data.length)), 8 + data.length);
    return c;
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const idat = zlib.deflateSync(Buffer.from([0, 200, 100, 50]));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

test('PNG text chunks go in before IEND with valid checksums', () => {
  const out = F.addPngText(tinyPng(), { Software: 'Spectre Lab 9.9.9 (build abc1234)' });
  const buf = Buffer.from(out), seen = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8);
    assert.equal(buf.readUInt32BE(o + 8 + len), F.crc32(buf.subarray(o + 4, o + 8 + len)), type);
    if (type === 'tEXt') assert.equal(buf.toString('latin1', o + 8, o + 8 + len), 'Software\0Spectre Lab 9.9.9 (build abc1234)');
    seen.push(type); o += 12 + len;
  }
  assert.deepEqual(seen, ['IHDR', 'IDAT', 'tEXt', 'IEND']);
});

test('PDF cross-reference offsets point at their objects', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = F.buildPdf({ jpeg, width: 400, height: 300, page: [595.28, 841.89], margin: 28.35, captionHeight: 14,
    caption: 'Spectre tiling (test) - v9.9.9', title: 'Spectre tiling', creator: 'Spectre Lab 9.9.9', date: new Date(Date.UTC(2026, 9, 16)) });
  const s = latin1(pdf);
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const xref = Number(/startxref\n(\d+)\n/.exec(s)[1]);
  assert.equal(s.slice(xref, xref + 4), 'xref');
  const rows = s.slice(xref).split('\n').slice(3, 10);
  rows.forEach((row, k) => assert.equal(s.slice(Number(row.slice(0, 10))).split('\n')[0], `${k + 1} 0 obj`));
  assert.match(s, /\/MediaBox \[0 0 841\.89 595\.28\]/);              // landscape picture, landscape page
  assert.match(s, /\(Spectre tiling \\\(test\\\) - v9\.9\.9\) Tj/);  // escaped caption
  assert.match(s, /\/CreationDate \(D:20261016000000Z\)/);
});

test('PDF can place the picture exactly and add vector drawing', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = F.buildPdf({ jpeg, width: 100, height: 60, page: [595.28, 841.89], landscape: true, margin: 28.35, captionHeight: 14,
    caption: 'tile', title: 'Spectre tile', creator: 'test', place: { x: 100, y: 120, w: 300, h: 180 }, extra: '0 0 m 10 10 l S\n' });
  const s = latin1(pdf);
  assert.match(s, /\/MediaBox \[0 0 841\.89 595\.28\]/);
  assert.match(s, /q 300\.00 0 0 180\.00 100\.00 120\.00 cm \/Im0 Do Q\n0 0 m 10 10 l S\nBT \/F1 8 Tf 0\.35 0\.37 0\.42 rg 28\.35 28\.35 Td \(tile\) Tj ET/);
  const xref = Number(/startxref\n(\d+)\n/.exec(s)[1]);
  const rows = s.slice(xref).split('\n').slice(3, 10);
  rows.forEach((row, k) => assert.equal(s.slice(Number(row.slice(0, 10))).split('\n')[0], `${k + 1} 0 obj`));
});

test('PDF can clip the picture to a path', () => {
  const pdf = F.buildPdf({ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 10, height: 10, page: [595.28, 841.89], margin: 28.35, captionHeight: 14,
    place: { x: 0, y: 0, w: 10, h: 10 }, clip: '0 0 m 10 0 l 10 10 l h\n' });
  assert.match(latin1(pdf), /q\n0 0 m 10 0 l 10 10 l h\nW n\nq 10\.00 0 0 10\.00 0\.00 0\.00 cm \/Im0 Do Q\nQ\n/);
});
