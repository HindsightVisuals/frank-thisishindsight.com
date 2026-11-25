// Renders the work sections from media/manifest.json (written by `npm run media`) and wires the brand guide
// viewer and the looping logo clips. A section with nothing in it stays hidden, along with its nav link.

const pad = n => String(n).padStart(2, '0');

// Which page a horizontally scrolled deck is showing.
export function pageIndex(scrollLeft, width, count) {
  if (!width || !count) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

function img(src, alt, { small, sizes, eager = false } = {}) {
  const i = el('img', { src, alt, decoding: 'async' });
  if (!eager) i.loading = 'lazy';
  if (small) { i.srcset = `${small.src} ${small.w}w, ${src} ${small.full}w`; i.sizes = sizes; }
  return i;
}

function renderLogos(root, items) {
  for (const l of items) {
    root.append(el('figure', { className: `tile ${l.bg === 'light' ? 'light' : ''}` },
      img(l.src, `${l.title} logo`), el('figcaption', { className: 'label', textContent: l.title })));
  }
}

// Muted clips that loop only while on screen (and show controls instead under reduced motion).
function looper(root, reduced) {
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) en.target.play().catch(() => { en.target.controls = true; });
      else en.target.pause();
    }
  }, { threshold: 0.35 });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const v of root.querySelectorAll('video')) v.pause();
  });
  return (src, poster, label) => {
    const video = el('video', { muted: true, loop: true, playsInline: true, preload: 'none', poster, src });
    video.setAttribute('aria-label', label);
    if (reduced) video.controls = true; else io.observe(video);
    return video;
  };
}

function renderMotion(root, items, reduced) {
  const video = looper(root, reduced);
  for (const m of items) {
    root.append(el('figure', { className: 'clip' }, video(m.src, m.poster, `${m.title} logo animation`),
      el('figcaption', { className: 'label cap', textContent: m.title })));
  }
}

function renderFlyers(root, items, reduced) {
  const video = looper(root, reduced);
  for (const f of items) {
    const media = f.video
      ? video(f.video, f.poster, `${f.title} flyer`)
      : img(f.src, `${f.title} flyer`, { small: { src: f.small, w: 600, full: 1200 }, sizes: '(max-width: 900px) 50vw, 25vw' });
    root.append(el('figure', {}, media, el('figcaption', { className: 'label cap', textContent: f.title })));
  }
}

function renderGuides(section, guides, reduced) {
  const tabs = section.querySelector('.deck-tabs');
  const wrap = section.querySelector('.deck-wrap');
  const deck = section.querySelector('.deck');
  const title = section.querySelector('.deck-title');
  const count = section.querySelector('.deck-count');
  const bar = section.querySelector('.deck-progress i');
  const prev = section.querySelector('.deck-prev');
  const next = section.querySelector('.deck-next');
  let guide = guides[0];

  const current = () => pageIndex(deck.scrollLeft, deck.clientWidth, guide.pages.length);
  const sync = () => {
    const i = current(), n = guide.pages.length;
    count.textContent = `${pad(i + 1)} / ${pad(n)}`;
    bar.style.width = `${((i + 1) / n) * 100}%`;
    prev.disabled = i === 0;
    next.disabled = i === n - 1;
  };
  const go = i => deck.scrollTo({ left: i * deck.clientWidth, behavior: reduced ? 'auto' : 'smooth' });

  const show = g => {
    guide = g;
    wrap.style.setProperty('--ar', (g.w / g.h).toFixed(4));
    title.textContent = g.note ? `${g.title} — ${g.note}` : g.title;
    deck.replaceChildren(...g.pages.map((p, i) => el('div', { className: 'slide' },
      img(p.src, `${g.title}, page ${i + 1}`, { small: { src: p.small, w: 1000, full: 2000 }, sizes: '(max-width: 600px) 100vw, 90vw', eager: i < 2 }))));
    deck.scrollLeft = 0;
    for (const t of tabs.children) t.setAttribute('aria-selected', String(t.dataset.title === g.title));
    sync();
  };

  if (guides.length > 1) {
    for (const g of guides) {
      const t = el('button', { className: 'btn', type: 'button', textContent: g.title });
      t.setAttribute('role', 'tab');
      t.dataset.title = g.title;
      t.addEventListener('click', () => show(g));
      tabs.append(t);
    }
  } else tabs.hidden = true;

  deck.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  prev.addEventListener('click', () => go(current() - 1));
  next.addEventListener('click', () => go(current() + 1));
  deck.addEventListener('keydown', ev => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (step) { ev.preventDefault(); go(current() + step); }
    if (ev.key === 'Home') { ev.preventDefault(); go(0); }
    if (ev.key === 'End') { ev.preventDefault(); go(guide.pages.length - 1); }
  });
  show(guide);
}

function renderSites(root, items) {
  for (const s of items) {
    const host = s.url ? new URL(s.url).host.replace(/^www\./, '') : '';
    const card = el(s.url ? 'a' : 'div', { className: 'site' },
      img(s.src, `${s.title} website`),
      el('span', { className: 'site-meta' },
        el('span', { className: 'label', textContent: s.title }),
        el('span', { className: 'label muted site-url', textContent: host ? `${host} ↗` : '' })));
    if (s.url) Object.assign(card, { href: s.url, target: '_blank', rel: 'noopener' });
    root.append(card);
  }
}

function renderArtwork(root, items) {
  for (const a of items) {
    root.append(el('figure', {},
      img(a.src, `${a.title} cover artwork`, { small: { src: a.small, w: 600, full: 1200 }, sizes: '(max-width: 900px) 50vw, 25vw' }),
      el('figcaption', { className: 'label cap', textContent: a.title })));
  }
}

function renderExtensions(root, items) {
  for (const e of items) {
    root.append(el('figure', { className: e.wide ? 'wide' : '' },
      img(e.src, e.title, { small: { src: e.small, w: 800, full: 1600 }, sizes: e.wide ? '(max-width: 600px) 100vw, 66vw' : '(max-width: 600px) 100vw, 33vw' }),
      el('figcaption', { className: 'label cap', textContent: e.title })));
  }
}

export async function initWork(root = document) {
  const res = await fetch('media/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const data = await res.json();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = {
    logos: s => renderLogos(s.querySelector('.logos'), data.logos),
    motion: s => renderMotion(s.querySelector('.motion'), data.motion, reduced),
    guides: s => renderGuides(s, data.guides, reduced),
    sites: s => renderSites(s.querySelector('.sites'), data.sites),
    artwork: s => renderArtwork(s.querySelector('.art'), data.artwork),
    flyers: s => renderFlyers(s.querySelector('.flyers'), data.flyers, reduced),
    extensions: s => renderExtensions(s.querySelector('.ext'), data.extensions),
  };
  let n = 0;
  for (const section of root.querySelectorAll('[data-section]')) {
    const key = section.dataset.section;
    if (!data[key]?.length) { root.querySelector(`.nav-links [data-for="${key}"]`)?.remove(); continue; }
    section.querySelector('.num').textContent = pad(++n);
    render[key](section);
    section.hidden = false;
  }
}
