# Hindsight × Frank

A one-page Hindsight portfolio made for Frank, to be served at https://frank.thisishindsight.com (GitHub Pages from
`main`). Started as a copy of [hindsight-untz](https://github.com/HindsightVisuals/hindsight-untz).

A branding portfolio for Frank Hunter: a message to him, then logos, logo animations, swipeable brand guides,
websites and brand extensions, ending on a contact link.

Static: `index.html`, `css/site.css`, `js/*.js`, with no build step for the page itself. The work sections are
rendered in the browser from `media/manifest.json`. A section with no items is hidden, along with its nav link.

**Everything in the work sections is currently a placeholder** (`content/placeholder/`).

## Adding the real work

1. List the work in `content/content.json`. Each `src` is a path to the original file, relative to this repo or
   absolute (a Dropbox path is fine; sources are only read).

   | Section | `src` | Other fields |
   | --- | --- | --- |
   | `logos` | SVG, PNG, JPG | `title`; `"bg": "light"` puts a dark logo on a white tile |
   | `motion` | MP4, MOV | `title`. Encoded muted, loops while on screen |
   | `guides` | PDF | `title`, `note`; optional `"pages": [1, 2, 5]` to show only some pages |
   | `sites` | a screenshot | `title`, `url`. Cropped to 16:10 from the top |
   | `extensions` | JPG, PNG | `title`; `"wide": true` spans two columns |

2. Run `npm install` once, then `npm run media`. It writes the web copies under `media/` and the manifest, skips
   outputs newer than their source, and deletes outputs that are no longer listed.
3. Run `npm test`.
4. Commit `content/content.json` and `media/`. The originals don't need to be in the repo.

The message to Frank and the contact line are plain text in `index.html`, marked `DRAFT COPY`.

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
