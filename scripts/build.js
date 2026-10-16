#!/usr/bin/env node
// Assembles src/ into one self-contained page: dist/spectre-lab.html.
// Stamps the version from package.json, a short hash of the sources, and the build time (UTC).
// Set SOURCE_DATE_EPOCH to fix the timestamp for a reproducible build.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const pkg = JSON.parse(read('package.json'));
// The modules export themselves for Node tests; the page does not need that line.
const stripExport = js => js.replace(/\nif \(typeof module !== 'undefined'\) module\.exports = \w+;\s*$/, '\n');

const page = read('src/page.html');
const core = stripExport(read('src/core.js'));
const formats = stripExport(read('src/fileformats.js'));
const app = read('src/app.js');

const hash = crypto.createHash('sha256').update([pkg.version, page, core, formats, app].join('\u0000')).digest('hex').slice(0, 7);
const when = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
const date = when.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

let html = page
  .replace('/*CORE*/', () => core)
  .replace('/*FORMATS*/', () => formats)
  .replace('/*APP*/', () => app);
html = html.split('__SPECTRE_VERSION__').join(pkg.version)
  .split('__SPECTRE_BUILD__').join(hash)
  .split('__SPECTRE_DATE__').join(date);

if (/__SPECTRE_|\/\*(CORE|FORMATS|APP)\*\//.test(html)) throw new Error('An unfilled placeholder is left in the page');
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]); // syntax check

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'spectre-lab.html'), html);
console.log(`dist/spectre-lab.html  v${pkg.version}  build ${hash}  ${date}  ${Math.round(html.length / 1024)} KB`);
