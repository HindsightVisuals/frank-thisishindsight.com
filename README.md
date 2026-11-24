# Hindsight × Frank

A one-page Hindsight portfolio made for Frank, to be served at https://frank.thisishindsight.com (GitHub Pages from
`main`). Started as a copy of [hindsight-untz](https://github.com/HindsightVisuals/hindsight-untz).

Static: `index.html`, `css/site.css`, `js/*.js`, with no build step. `media/` holds compressed copies of the Dropbox
originals and is committed.

## Rebuild media

The sources live in `Dropbox/Hindsight/01_Portfolio Site/00_Assets and Content` and are only read, never written.

1. Extract the Submersion photo zip from `00_Images` into `.cache/zip/`.
2. Run `npm install`.
3. Run `npm run media`. Outputs that are newer than their source are skipped, so delete one to force a re-encode.
4. Run `npm test` to check the size budgets.

The 10 gallery photos are listed in `scripts/photos.json`.

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
