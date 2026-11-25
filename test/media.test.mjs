import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024;
const size = p => fs.statSync(p).size;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const manifest = JSON.parse(fs.readFileSync('media/manifest.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('content/content.json', 'utf8'));

// Every media path the page will request.
const refs = [
  ...manifest.logos.map(l => l.src),
  ...manifest.motion.flatMap(m => [m.src, m.poster]),
  ...manifest.guides.flatMap(g => g.pages.flatMap(p => [p.src, p.small])),
  ...manifest.sites.map(s => s.src),
  ...manifest.artwork.flatMap(a => [a.src, a.small]),
  ...manifest.flyers.flatMap(f => f.video ? [f.video, f.poster] : [f.src, f.small]),
  ...manifest.extensions.flatMap(e => [e.src, e.small]),
];

test('loader video exists and is under 3 MB', () => {
  assert.ok(size('media/video/loader.mp4') < 3 * MB);
});

test('the manifest matches content.json (run `npm run media` after editing it)', () => {
  for (const key of ['logos', 'motion', 'guides', 'sites', 'artwork', 'flyers', 'extensions']) {
    assert.deepEqual(manifest[key].map(i => i.title), (content[key] ?? []).map(i => i.title), key);
  }
});

test('every file the manifest points at exists', () => {
  for (const f of refs) assert.ok(fs.existsSync(f) && size(f) > 0, f);
});

test('every guide has pages and a page size', () => {
  for (const g of manifest.guides) assert.ok(g.pages.length > 0 && g.w > 0 && g.h > 0, g.title);
});

test('guide pages are each under 1 MB, logo clips under 8 MB', () => {
  for (const g of manifest.guides) for (const p of g.pages) assert.ok(size(p.src) < 1 * MB, p.src);
  for (const m of manifest.motion) assert.ok(size(m.src) < 8 * MB, m.src);
  for (const f of manifest.flyers) if (f.video) assert.ok(size(f.video) < 12 * MB, f.video);
});

test('no file under media/ is 50 MB or more', () => {
  for (const f of walk('media')) assert.ok(size(f) < 50 * MB, f);
});
