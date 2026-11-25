// Turns the sources listed in content/content.json into web media under media/, and writes media/manifest.json,
// which the page renders from. Run: npm run media. Outputs newer than their source are skipped; outputs no
// longer listed are deleted. Sources are only read. `src` is relative to the repo root, or to the content root.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import * as mupdf from 'mupdf';

const CONTENT = 'content/content.json';
const OUT = 'media';
const MANAGED = ['guides', 'logos', 'motion', 'sites', 'art', 'flyers', 'ext'];   // build-owned folders under media/
const GUIDE_WIDTHS = [2000, 1000];
const PHOTO_WIDTHS = [1600, 800];
const ART_WIDTHS = [1200, 600];
const SITE_RATIO = 16 / 10;

const written = new Set();
const keep = p => { written.add(path.normalize(p)); return p; };
const fresh = (out, src) => fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs;
const slugify = (s, i) => `${String(i + 1).padStart(2, '0')}-${String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const url = p => p.split(path.sep).join('/');

// Where the originals live on this machine. Kept out of the repo (it is a personal path): the CONTENT_ROOT
// environment variable, or the one line in the untracked file .content-root.
const ROOT = process.env.CONTENT_ROOT || (fs.existsSync('.content-root') ? fs.readFileSync('.content-root', 'utf8').trim() : '');

function source(item, kind) {
  if (!item.src) throw new Error(`${kind} "${item.title}" has no src`);
  const found = [item.src, ...(ROOT ? [path.join(ROOT, item.src)] : [])].find(p => fs.existsSync(p));
  if (!found) throw new Error(`${kind} "${item.title}": source not found: ${item.src}${ROOT ? '' : ' (no content root set, see README)'}`);
  return found;
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

// Logos are shown white on black. Every fill and stroke colour in an SVG becomes white, except the colours an
// item lists in `knockout`, which become black: a background plate, or detail cut out of the mark. Shapes with
// no colour of their own (black by SVG default) follow the root fill, so `"default"` in `knockout` keeps them
// black. `"color": "original"` leaves an SVG untouched.
function whiten(svg, knockout = [], black = '#000') {
  const out = new Set(knockout.map(c => c.toLowerCase()));
  return svg
    .replace(/\b(fill|stroke)(\s*[:=]\s*["']?\s*)(#[0-9a-f]{3,8}|white|black|rgba?\([^)]*\))/gi, (_, prop, sep, c) => `${prop}${sep}${out.has(c.toLowerCase()) ? black : '#fff'}`)
    .replace(/<svg\b(?![^>]*\sfill=)/i, `<svg fill="${out.has('default') ? black : '#fff'}"`);
}

// Crops an SVG's viewBox to its artwork, so every logo fills its own box and the page can size them alike
// (some files carry a lot of empty canvas). `ink` is the same SVG with the knockout colours made transparent:
// a background plate is not artwork. Returns the cropped SVG and its width / height.
async function cropSvg(svg, ink) {
  const vb = svg.match(/viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)/i);
  if (!vb) return { svg, ar: null };
  const [x0, y0, vw, vh] = vb.slice(1).map(Number);
  const W = 1200, H = Math.max(1, Math.round(W * vh / vw));
  const sized = ink.replace(/<svg\b([^>]*)>/i, (_, attrs) => `<svg${attrs.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '')} width="${W}" height="${H}">`);
  const { data, info } = await sharp(Buffer.from(sized)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
  }
  if (r < 0) return { svg, ar: vw / vh };
  const k = vw / info.width, pad = 0.01 * Math.max(vw, vh);
  const box = [x0 + l * k - pad, y0 + t * k - pad, (r - l + 1) * k + 2 * pad, (b - t + 1) * k + 2 * pad];
  const cropped = svg.replace(/<svg\b([^>]*)>/i, (_, attrs) => '<svg' + attrs
    .replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${box.map(n => +n.toFixed(3)).join(' ')}"`) + '>');
  return { svg: cropped, ar: box[2] / box[3] };
}

async function logos(items) {
  const out = [];
  for (const [i, l] of items.entries()) {
    const src = source(l, 'logo');
    const svg = path.extname(src).toLowerCase() === '.svg';
    const file = keep(path.join(OUT, 'logos', `${slugify(l.title, i)}.${svg ? 'svg' : 'webp'}`));
    let ar;
    if (svg) {
      const raw = fs.readFileSync(src, 'utf8');
      const art = l.color === 'original' ? raw : whiten(raw, l.knockout);
      const cropped = await cropSvg(art, l.color === 'original' ? raw : whiten(raw, l.knockout, 'none'));
      fs.writeFileSync(file, cropped.svg);
      ar = cropped.ar;
    } else {
      if (!fresh(file, src)) await sharp(src).rotate().trim().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toFile(file);
      const m = await sharp(file).metadata();
      ar = m.width / m.height;
    }
    // ar: the artwork's width / height, which the page uses to give every logo the same visual weight
    out.push({ title: l.title ?? '', src: url(file), bg: l.bg === 'light' ? 'light' : 'dark', ar: +(ar ?? 1).toFixed(3), ...(l.scale ? { scale: l.scale } : {}) });
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
    clip(m, src, file, poster, 1280, 24);
    out.push({ title: m.title ?? '', src: url(file), poster: url(poster) });
  }
  console.log(`motion: ${out.length}`);
  return out;
}

// Encodes a muted web clip and its poster. `start` / `end` (seconds) cut a piece out of a longer source.
// The poster is the last frame, since a logo animation usually ends on the finished logo; `poster` (seconds
// into the cut clip) picks another frame when the clip ends on black.
function clip(item, src, file, poster, width, crf) {
  if (!fresh(file, src)) {
    const cut = [...(item.start != null ? ['-ss', String(item.start)] : []), ...(item.end != null ? ['-to', String(item.end)] : [])];
    run([...cut, '-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-vf', `scale='min(${width},iw)':-2`, '-movflags', '+faststart', '-an', file]);
  }
  if (!fresh(poster, src)) {
    const at = item.poster != null ? ['-ss', String(item.poster)] : ['-sseof', '-0.2'];
    run([...at, '-i', file, '-frames:v', '1', '-update', '1', '-q:v', '4', poster]);
  }
}

// A flyer is a still (JPG, PNG) or an animated one (MP4, MOV); both sit in the same grid.
async function flyers(items) {
  const out = [];
  for (const [i, f] of items.entries()) {
    const src = source(f, 'flyer');
    const slug = slugify(f.title, i);
    if (/\.(mp4|mov|webm)$/i.test(src)) {
      const file = keep(path.join(OUT, 'flyers', `${slug}.mp4`));
      const poster = keep(path.join(OUT, 'flyers', `${slug}.jpg`));
      clip(f, src, file, poster, 800, 27);
      out.push({ title: f.title ?? '', video: url(file), poster: url(poster) });
    } else {
      const files = ART_WIDTHS.map(w => keep(path.join(OUT, 'flyers', `${slug}-${w}.webp`)));
      for (const [k, w] of ART_WIDTHS.entries()) {
        if (!fresh(files[k], src)) await sharp(src).rotate().resize({ width: w }).webp({ quality: 80 }).toFile(files[k]);
      }
      out.push({ title: f.title ?? '', src: url(files[0]), small: url(files[1]) });
    }
  }
  console.log(`flyers: ${out.length}`);
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

async function artwork(items) {
  const out = [];
  for (const [i, a] of items.entries()) {
    const src = source(a, 'artwork');
    const slug = slugify(a.title, i);
    const files = ART_WIDTHS.map(w => keep(path.join(OUT, 'art', `${slug}-${w}.webp`)));
    for (const [k, w] of ART_WIDTHS.entries()) {
      if (!fresh(files[k], src)) await sharp(src).rotate().resize(w, w, { fit: 'cover' }).webp({ quality: 80 }).toFile(files[k]);
    }
    out.push({ title: a.title ?? '', src: url(files[0]), small: url(files[1]) });
  }
  console.log(`artwork: ${out.length}`);
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
  artwork: await artwork(content.artwork ?? []),
  flyers: await flyers(content.flyers ?? []),
  extensions: await extensions(content.extensions ?? []),
};
prune();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote media/manifest.json');
