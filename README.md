# Hindsight × Frank

A one-page Hindsight portfolio made for Frank, to be served at https://frank.thisishindsight.com (GitHub Pages from
`main`). Started as a copy of [hindsight-untz](https://github.com/HindsightVisuals/hindsight-untz).

A branding portfolio for Frank Hunter: a message to him, then logos, logo animations, swipeable brand guides,
websites and brand extensions, ending on a contact link.

Static: `index.html`, `css/site.css`, `js/*.js`, with no build step for the page itself. The work sections are
rendered in the browser from `media/manifest.json`. A section with no items is hidden, along with its nav link.

Site screenshots live in `content/sites/`. `content/placeholder/` holds the stand-in files the page was built with.

## Adding the real work

1. List the work in `content/content.json`. Each `src` is a path to the original file, relative to this repo or
   to the content root: the folder the originals live in, named by the `CONTENT_ROOT` environment variable or the
   one line in an untracked `.content-root` file. Sources are only read. Keep machine paths out of this file: the
   repo is public.

   | Section | `src` | Other fields |
   | --- | --- | --- |
   | `logos` | SVG, PNG, JPG | `title`. SVGs are recoloured white on black; `"knockout": ["#1f1f1f"]` lists colours to turn black instead (a background plate, cut-out detail), `"color": "original"` leaves the file as it is, `"bg": "light"` gives a white tile |
   | `motion` | MP4, MOV | `title`. Encoded muted, loops while on screen. Optional `start` / `end` (seconds) cut a piece out of a longer file; `poster` (seconds) picks the still when the clip ends on black |
   | `guides` | PDF | `title`, `note`; optional `"pages": [1, 2, 5]` to show only some pages |
   | `sites` | a screenshot | `title`, `url`. Cropped to 16:10 from the top |
   | `artwork` | JPG, PNG | `title`. Cover art, cropped square |
| `flyers` | JPG, PNG, MP4, MOV | `title`. Stills and animated flyers share one 4:5 grid; videos take `start` / `end` / `poster` too |
| `extensions` | JPG, PNG | `title`; `"wide": true` spans two columns |

2. Run `npm install` once, then `npm run media`. It writes the web copies under `media/` and the manifest, skips
   outputs newer than their source, and deletes outputs that are no longer listed.
3. Run `npm test`.
4. Commit `content/content.json` and `media/`. The originals don't need to be in the repo.

The message to Frank and the closing line are plain text in `index.html`.

## Local preview

`npx http-server -p 5190 -c-1`, then open http://127.0.0.1:5190. Query params:

- `?nowebgl` shows the background fallback.
- `?debug` exposes `window.__rdStep()`.

## Going live

1. Merge to `main` and enable GitHub Pages (Settings → Pages → deploy from `main`). The repo is private, so Pages
   needs a paid GitHub plan, or the repo made public.
2. DNS (Squarespace): CNAME record, host `frank` → `hindsightvisuals.github.io`. Enable "Enforce HTTPS" once the
   cert issues.
3. Add `frank.thisishindsight.com` to the Typekit kit `jhm5bdq`, or the headings fall back to Krona One.
