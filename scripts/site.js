#!/usr/bin/env node
// Builds the GitHub Pages site in _site/ from dist/spectre-lab.html.
// The dist page is a fragment: claude.ai wraps it in a document when it runs as an artifact.
// A plain web host serves it as is, so here it gets a doctype, a charset, a mobile viewport,
// a favicon and link-preview tags. Without the viewport, phones lay the page out 980px wide.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');

const SITE_URL = 'https://sockmonke-rgb.github.io/Spectre-Lab/';
const DESCRIPTION = 'Explore the Spectre, the aperiodic monotile: grow the tiling, colour it, design your own tile, and export PNG or PDF.';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The Spectre outline as an SVG favicon, from the engine's own 14 vertices.
function faviconHref() {
  const pts = C.PTS.map(p => C.toXY(p));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = 28 / Math.max(x1 - x0, y1 - y0), ox = 16 - (x0 + x1) / 2 * k, oy = 16 + (y0 + y1) / 2 * k;
  const d = 'M' + pts.map(p => (ox + p[0] * k).toFixed(2) + ' ' + (oy - p[1] * k).toFixed(2)).join('L') + 'Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${d}" fill="#f4bf8a" stroke="#1d1b18" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function makeSite(fragment, { url = SITE_URL, image = 'social.png' } = {}) {
  if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(fragment)) throw new Error('The page already has a document around it');
  const head = [
    '<!doctype html>',
    '<html lang="en">',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta name="description" content="${esc(DESCRIPTION)}">`,
    `<link rel="icon" href="${faviconHref()}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Spectre Lab">',
    '<meta property="og:title" content="Spectre Lab">',
    `<meta property="og:description" content="${esc(DESCRIPTION)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(url + image)}">`,
    '<meta property="og:image:width" content="1280">',
    '<meta property="og:image:height" content="640">',
    '<meta property="og:image:alt" content="A Spectre tiling coloured by hexagon type, with the Spectre Lab title">',
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  return head.join('\n') + '\n' + fragment;
}

if (require.main === module) {
  const root = path.join(__dirname, '..'), out = path.join(root, '_site');
  fs.mkdirSync(out, { recursive: true });
  const html = makeSite(fs.readFileSync(path.join(root, 'dist', 'spectre-lab.html'), 'utf8'));
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.copyFileSync(path.join(root, 'docs', 'social.png'), path.join(out, 'social.png'));
  console.log(`_site/index.html  ${Math.round(html.length / 1024)} KB  +  _site/social.png`);
}

module.exports = { makeSite, SITE_URL };
