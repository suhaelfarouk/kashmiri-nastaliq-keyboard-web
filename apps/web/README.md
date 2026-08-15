# Makhzan (web)

Unicode Kashmiri (Perso-Arabic / Nastaliq) typing in the browser, with a WYSIWYG
Markdown editor powered by Tiptap.

**Deploy target:** Vercel (this package only).  
**Root Directory:** `apps/web`

## Features

- WYSIWYG Markdown editor (Tiptap)
- Smart Kashmiri phonetic mode and Direct QWERTY
- Four keyboard layers; show-both-layers toggle
- Fonts: Noto Nastaliq Urdu, Gulmarg Nastaliq, Scheherazade New
- Preview panel, minimal view, Open / Download `.md`, local draft autosave
- Makhzan handoff: `/?from=makhzan` → **Paste from Makhzan** (clipboard; no auth)

## Prerequisites

Node.js `^20.19.0` or `>=22.12.0` (see `package.json` `engines`).

## Commands

```bash
cd apps/web
npm install
npm start          # Vite → http://localhost:8080
npm test
npm run build     # → dist/
npm run preview
npm run deploy    # vercel --prod
```

## Deploy

```bash
npx vercel
npx vercel --prod
```

`vercel.json` sets `"framework": null` with explicit `buildCommand` /
`outputDirectory`. Prefer those over a dashboard Vite preset if they differ.

## Privacy

- Drafts in `localStorage` under `makhzan-v1`
- No account or server-side document store
- Makhzan paste requires HTTPS (or localhost) and an explicit click

## Layout

```text
index.html
style.css
vite.config.js
vercel.json
package.json
public/fonts/
src/
tests/
```

Companion app and model tooling live elsewhere in the monorepo:

- [`../native/`](../native/) — native Makhzan app
- [`../../tools/model/`](../../tools/model/) — ONNX export + R2 publish
- [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) — deploy matrix
