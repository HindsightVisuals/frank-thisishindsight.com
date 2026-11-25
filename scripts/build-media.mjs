// Turns the sources listed in content/content.json into web media under media/, and writes media/manifest.json,
// which the page renders from. Run: npm run media. Outputs newer than their source are skipped; outputs no
// longer listed are deleted. Sources are only read. `src` is relative to the repo root, or absolute.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import * as mupdf from 'mupdf';

const CONTENT = 'content/content.json';
const OUT = 'media';
const MANAGED = ['guides', 'logos', 'motion', 'sites', 'ext'];   // build-owned folders under media/
const GUIDE_WIDTHS = [2000, 1000];
const PHOTO_WIDTHS = [1600, 800];
const SITE_RATIO = 16 / 10;

const written = new Set();
const keep = p => { written.add(path.normalize(p)); return p; };
const fresh = (out, src) => fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs;
const slugify = (s, i) => `${String(i + 1).padStart(2, '0')}-${String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const url = p => p.split(path.sep).join('/');

function source(item, kind) {
  if (!item.src) throw new Error(`${kind} "${item.title}" has no src`);
  if (!fs.existsSync(item.src)) throw new Error(`${kind} "${item.title}": source not found: ${item.src}`);
  return item.src;
}

function run(args) {
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

async function guides(items) {
  const out = [];
  for (const [i, g] of items.entries()) {
    const src = source(g, 'guide');
    const slug = slugify(g.title, i);
    const dir = path.join(OUT, 'guides', slug);
    fs.mkdirSync(dir, { recursive: true });
    const doc = mupdf.Document.openDocument(fs.readFileSync(src), 'application/pdf');
    const picks = g.pages ?? Array.from({ length: doc.countPages() }, (_, n) => n + 1);
    const pages = [];
    for (const [n, pageNo] of picks.entries()) {
      if (pageNo < 1 || pageNo > doc.countPages()) throw new Error(`guide "${g.title}": no page ${pageNo}`);
      const name = String(n + 1).padStart(2, '0');
      const files = GUIDE_WIDTHS.map(w => keep(path.join(dir, `${name}-${w}.webp`)));
      const page = doc.loadPage(pageNo - 1);
      const [x0, y0, x1, y1] = page.getBounds();
      if (!files.every(f => fresh(f, src))) {
        const scale = GUIDE_WIDTHS[0] / (x1 - x0);
        const png = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true).asPNG();
        for (const [k, w] of GUIDE_WIDTHS.entries()) await sharp(png).resize({ width: w }).webp({ quality: 82 }).toFile(files[k]);
      }
      pages.push({ src: url(files[0]), small: url(files[1]) });
      if (n === 0) Object.assign(g, { _w: Math.round(x1 - x0), _h: Math.round(y1 - y0) });
    }
    out.push({ title: g.title, note: g.note ?? '', w: g._w, h: g._h, pages });
    console.log(`guide: ${g.title} (${pages.length} pages)`);
  }
  return out;
}

async function logos(items) {
  const out = [];
  for (const [i, l] of items.entries()) {
    const src = source(l, 'logo');
    const svg = path.extname(src).toLowerCase() === '.svg';
    const file = keep(path.join(OUT, 'logos', `${slugify(l.title, i)}.${svg ? 'svg' : 'webp'}`));
    if (!fresh(file, src)) {
      if (svg) fs.copyFileSync(src, file);
      else await sharp(src).rotate().trim().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toFile(file);
    }
    out.push({ title: l.title ?? '', src: url(file), bg: l.bg === 'light' ? 'light' : 'dark' });
  }
  console.log(`logos: ${out.length}`);
  return out;
}

async function motion(items) {
  const out = [];
  for (const [i, m] of items.entries()) {
    const src = source(m, 'motion clip');
    const slug = slugify(m.title, i);
    const file = keep(path.join(OUT, 'motion', `${slug}.mp4`));
    const poster = keep(path.join(OUT, 'motion', `${slug}.jpg`));
    if (!fresh(file, src)) {
      run(['-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
        '-vf', "scale='min(1280,iw)':-2", '-movflags', '+faststart', '-an', file]);
    }
    // The poster is the last frame: a logo animation usually ends on the finished logo.
    if (!fresh(poster, src)) run(['-sseof', '-0.2', '-i', file, '-frames:v', '1', '-update', '1', '-q:v', '4', poster]);
    out.push({ title: m.title ?? '', src: url(file), poster: url(poster) });
  }
  console.log(`motion: ${out.length}`);
  return out;
}

async function sites(items) {
  const out = [];
  for (const [i, s] of items.entries()) {
    const src = source(s, 'site');
    const file = keep(path.join(OUT, 'sites', `${slugify(s.title, i)}.webp`));
    // Screenshots are cropped from the top, so a full-page capture shows its header and hero.
    if (!fresh(file, src)) await sharp(src).resize(1600, Math.round(1600 / SITE_RATIO), { fit: 'cover', position: 'top' }).webp({ quality: 80 }).toFile(file);
    out.push({ title: s.title ?? '', url: s.url ?? '', src: url(file) });
  }
  console.log(`sites: ${out.length}`);
  return out;
}

async function extensions(items) {
  const out = [];
  for (const [i, e] of items.entries()) {
    const src = source(e, 'extension');
    const slug = slugify(e.title, i);
    const files = PHOTO_WIDTHS.map(w => keep(path.join(OUT, 'ext', `${slug}-${w}.webp`)));
    for (const [k, w] of PHOTO_WIDTHS.entries()) {
      if (!fresh(files[k], src)) await sharp(src).rotate().resize(w, w, { fit: 'inside' }).webp({ quality: 78 }).toFile(files[k]);
    }
    out.push({ title: e.title ?? '', src: url(files[0]), small: url(files[1]), wide: !!e.wide });
  }
  console.log(`extensions: ${out.length}`);
  return out;
}

function prune() {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const sub of MANAGED) {
    const dir = path.join(OUT, sub);
    for (const f of walk(dir)) if (!written.has(path.normalize(f))) { fs.rmSync(f); console.log(`removed ${f}`); }
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory() && !fs.readdirSync(path.join(dir, d.name)).length) fs.rmdirSync(path.join(dir, d.name));
    }
  }
}

const content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
for (const sub of MANAGED) fs.mkdirSync(path.join(OUT, sub), { recursive: true });
const manifest = {
  logos: await logos(content.logos ?? []),
  motion: await motion(content.motion ?? []),
  guides: await guides(content.guides ?? []),
  sites: await sites(content.sites ?? []),
  extensions: await extensions(content.extensions ?? []),
};
prune();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote media/manifest.json');
