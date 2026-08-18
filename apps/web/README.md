# Makhzan (web)

Unicode Kashmiri (Perso-Arabic / Nastaliq) typing in the browser, with a simple
WYSIWYG Word-document editor powered by Tiptap. What you see while typing is
exactly what Preview and Print show. Open and Download use `.docx`.

**Deploy target:** Vercel (this package only).  
**Root Directory:** `apps/web`

## Features

- WYSIWYG document editor (Tiptap) — editor, Preview, and Print always match
- Smart Kashmiri phonetic mode and Direct QWERTY
- Four keyboard layers; show-both-layers toggle
- Fonts: Noto Nastaliq Urdu, Gulmarg Nastaliq, Scheherazade New, plus
  local-installed Faiz Lahori Nastaleeq
- Preview panel, minimal view, Print, Open / Download `.docx`, local draft autosave
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
It also sets security headers (CSP, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, HSTS) scoped to the app's actual needs — self-hosted
scripts/styles plus the Google Fonts origins used for hosted Nastaliq faces.

## Privacy

- Drafts in `localStorage` under `makhzan-v1` (payload version 2 stores HTML)
- No account or server-side document store
- Makhzan paste requires HTTPS (or localhost) and an explicit click

## Document format

The editor is still a browser WYSIWYG (Tiptap / ProseMirror). Word is the
**file** format, not the editing engine.

- **Open / Download:** OOXML `.docx`
- **Legacy `.doc`** (Word 97–2003 OLE) is rejected. Re-save as `.docx` in Word.
- **`.txt`** opens as unformatted paragraphs (a convenience for transcript dumps).
- Round-trip covers headings 1–3, paragraphs, lists, blockquotes, code,
  bold/italic/strike, links, and horizontal rules.
- Images, tables, comments, and track changes are not preserved.
- The chosen Nastaliq face is **named** in the `.docx` file; the font file is
  not embedded. Another computer uses it only if that face is installed there.

## Faiz Lahori Nastaleeq

The **Faiz Lahori Nastaleeq (installed locally)** preset uses a licensed copy
already installed on the visitor's device. Makhzan does not download or
redistribute this proprietary font. The preset checks these local family names:

- `Faiz Lahori Nastaleeq`
- `FaizLahoriNastaleeq`
- `Faiz Lahori Nastaliq`

If none is installed, the browser falls back to Gulmarg Nastaliq and then Noto
Nastaliq Urdu. Consequently, selecting the preset does not guarantee that
another device will display Faiz; exported `.docx` files name the face but do
not embed the font file.

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
