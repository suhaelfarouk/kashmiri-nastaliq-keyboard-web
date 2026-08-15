# Kashmiri Nastaliq Keyboard

Unicode Kashmiri (Perso-Arabic / Nastaliq) typing for the browser, with a WYSIWYG Markdown editor powered by Tiptap. Phonetic and direct QWERTY input, four keyboard layers, curated Arabic-script fonts, and local draft autosave.

## Features

- **WYSIWYG Markdown editor** (Tiptap): headings, bold/italic/strike, lists, links, quotes, code
- **Smart Kashmiri** phonetic mode: Latin sequences such as `sh` → ش, `chh` → چھ, `aa` → آ
- **Direct QWERTY** mode: one physical key → one Kashmiri character
- **Four keyboard layers** — Base, Shift, Alt, and Alt + Shift
- **Show both layers** toggle: base + Shift characters side by side on each key
- **Extended character palette** for vowels, combining marks, aspirates, loan letters
- **Curated fonts**: Noto Nastaliq Urdu, Gulmarg Nastaliq (self-hosted), Scheherazade New — plus a font size selector
- **One-line editor** (drag its bottom edge to grow) plus a **Preview** panel that
  shows the whole document, rendered or as raw Markdown
- **Open / Download `.md`**, copy Markdown, and debounced browser autosave

## Quick start

```bash
npm install
npm start
# open http://localhost:8080
```

Other scripts:

```bash
npm run build    # production bundle → dist/
npm run preview  # preview the production build
npm test
```

## Deploy to Vercel

```bash
npx vercel        # preview
npx vercel --prod # production
```

Or import the Git repo in the [Vercel dashboard](https://vercel.com/new). Framework Preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.

## Project layout

```
index.html              # Shell (editor mount + keyboard host)
style.css               # Compact neutral UI + ProseMirror styles
vite.config.js          # Vite build
package.json
public/
  fonts/
    GulmargNastaliq.woff2  # Self-hosted Kashmiri Nastaliq face
src/
  main.js               # Entry point
  app.js                # Wires controllers together
  data/
    keyboard.js         # Canonical key rows, four layers per key
    characters.js       # Extended Kashmiri Unicode inventory
    font-presets.js     # Document-level font presets
    marks.js            # Combining-mark placement helpers
    transliteration.js  # Phonetic rules, marks, help examples
  core/
    transliterator.js  # Pure buffered longest-match engine
  ui/
    editor.js           # Tiptap adapter (insert / Markdown / status)
    format-toolbar.js  # Formatting toolbar
    autosave.js         # localStorage drafts
    file-io.js          # Open / download .md
    character-palette.js
    keyboard.js
tests/
  characters.test.js
  editor.test.js
  file-io.test.js
  font-presets.test.js
  keyboard.test.js
  transliterator.test.js
```

## Controls

| Control | Effect |
|---|---|
| Formatting toolbar | Toggle Markdown-friendly rich text styles |
| Font | Document-level face (not stored inside `.md`) |
| Size | Editor body size, 18–48 px (not stored inside `.md`) |
| Preview | Show the full document: Rendered or raw Markdown |
| Open / Download | Load or save a Markdown file |
| Copy Markdown | Clipboard export of `getMarkdown()` |
| Keyboard mapping | Intercept physical keys into Kashmiri |
| Show both layers | Draw two faces together; Shift still selects which one inserts |
| Mode | Smart Kashmiri (phonetic buffer) or Direct QWERTY |
| Normal / Shift / Alt / Alt + Shift | Sticky layer selector for the on-screen keyboard |

## Layers

Each key in `src/data/keyboard.js` carries up to four characters:

| Layer | Contents |
|---|---|
| Base | Everyday letters, Kashmiri digits, common punctuation |
| Shift | Alternate letters and the most frequent marks |
| Alt | Aspirated digraphs, vowel sequences, remaining combining marks |
| Alt + Shift | Loan-word consonants, precomposed vowels, punctuation, ZWNJ / ZWJ |

## Orthography notes

Phonetic mode is an **input method**, not a full linguistic romanization. Longest-match rules resolve digraphs before single letters. Combining marks:

- `~` → ٟ (U+065F)
- `^` → ٖ (U+0656)
- `:` → ٗ (U+0657)

Short `a`, `i`, and `u` are position-aware: at the beginning of a word they
receive the required alef carrier (`اَ`, `اِ`, `اُ`); after a consonant they are
inserted as bare vowel marks (`َ`, `ِ`, `ُ`). Likewise, `a~` produces `اٟ`
word-initially and the bare `ٟ` mark medially.

Final short `i` inserts kasra (`ِ`); use `ii` / `ee` for ی.

The page and editor use `lang="ks"` with Noto Nastaliq Urdu (or another preset) so Kashmiri-specific glyph substitutions can be selected by the font. Combining marks are shown bare on keycaps and palette buttons.

Font and size are editor metadata (autosave / UI), not Markdown, so exported `.md` files stay portable across tools.

## Fonts

| Preset | Style | Delivery |
|---|---|---|
| Noto Nastaliq Urdu | Nastaliq | Google Fonts (v3.002+ covers Kashmiri when `lang="ks"`) |
| Gulmarg Nastaliq | Nastaliq | Self-hosted `public/fonts/GulmargNastaliq.woff2` (~141 KB) |
| Scheherazade New | Naskh | Google Fonts |

Gulmarg is not on Google Fonts, so it is bundled as WOFF2 and declared with an
`@font-face` rule that prefers a locally installed copy via `local("Gulmarg Nastaleeq")`.
Note that Gulmarg lacks glyphs for a few Kashmiri characters (notably Kashmiri
yeh and waw with ring) — Noto Nastaliq Urdu remains the most complete option and
is the default. Verify the Gulmarg license before redistributing the bundled file.

## References

- Unicode Arabic script / Kashmiri vowel marks
- W3C Perso-Arabic Kashmiri layout requirements
- Richard Ishida: Kashmiri Nastaliq orthography notes
- [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown)
