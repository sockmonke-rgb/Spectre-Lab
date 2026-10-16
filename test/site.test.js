'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSite } = require('../scripts/site.js');

test('the site page is a standards-mode document with a mobile viewport', () => {
  const html = makeSite('<title>Spectre Lab</title>\n<p>hello</p>');
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">\n<meta charset="utf-8">'));
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+social\.png">/);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.ok(html.endsWith('<title>Spectre Lab</title>\n<p>hello</p>'));
});

test('the built page is still a fragment, so the site build can wrap it', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'dist', 'spectre-lab.html'), 'utf8');
  assert.doesNotThrow(() => makeSite(page));
});

test('a page that already has a document is refused', () => {
  assert.throws(() => makeSite('<!doctype html><html><body></body></html>'));
});
