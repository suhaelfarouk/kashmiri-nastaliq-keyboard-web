# Architecture

This document explains how the web editor, Flutter companion, model package,
and Cloudflare R2 release system fit together.

## System overview

```text
AI4Bharat gated NeMo checkpoint
  → tools/model/scripts/export_ctc_onnx.py
  → model.onnx + vocab.json + config.json
  → tools/model/scripts/publish_r2.py
  → signed manifest + immutable archive on R2
  → Flutter model manager
  → verified local model
  → microphone WAV
  → log-mel features
  → ONNX CTC logits
  → greedy decode
  → editable transcript
  → clipboard
  → web editor ?from=makhzan
  → user-initiated paste
```

The web editor and Flutter app are deliberately decoupled. They share text only
through the device clipboard and a public URL flag. There is no user account,
backend transcript API, or audio upload service.

## Trust boundaries

### Publisher machine

The publisher machine holds:

- Hugging Face token;
- R2 write credentials;
- Ed25519 private signing key;
- generated model artifacts.

These values must not enter Git, the web application, or Flutter application
assets.

### Cloudflare R2

R2 stores:

- immutable versioned model archives;
- versioned signed manifests;
- `manifest-latest.json`.

R2 content is public and must contain no credentials or private user data.

### Flutter application

The app contains:

- public model manifest URL;
- Ed25519 public key supplied at build time;
- local recorder, downloader, verifier, and inference code.

The public key verifies authenticity. It cannot sign new manifests.

### Browser

The browser receives only:

- the editor application;
- text the user explicitly pastes from the system clipboard.

Clipboard reading requires a user gesture and HTTPS.

## Web editor

### Bootstrap

`src/main.js` calls `initApp(document)` from `src/app.js`.

`initApp` creates the editor first, then creates controllers that depend on it:

- keyboard;
- character palette;
- formatting toolbar;
- preview;
- autosave;
- file I/O;
- menu visibility;
- Makhzan handoff.

### Editor

`src/ui/editor.js` wraps Tiptap. It exposes a small API used by the rest of the
application:

- insert text;
- delete/backspace;
- read/write Markdown;
- set typography;
- copy Markdown;
- focus and status updates.

The document is Markdown. Font face and size are display preferences and are
not embedded into exported Markdown.

### Input

`src/data/keyboard.js` is the canonical four-layer key map.

`src/core/transliterator.js` is a buffered longest-match engine.
`src/data/transliteration.js` contains the Kashmiri phonetic rules.

The on-screen keyboard and physical keyboard call the same insertion path.

### Persistence

`src/ui/autosave.js` stores the current draft and editor preferences in browser
local storage. There is no server-side document storage.

### Makhzan handoff

`src/ui/makhzan-handoff.js` checks for `from=makhzan` in the URL. It shows a banner
and reads the clipboard only after the user clicks **Paste from Makhzan**. After a
successful paste, it removes the query parameter from browser history.

## Model package

A model package contains:

```text
model.onnx
vocab.json
config.json
```

The app writes `INSTALL.json` only after verification and installation.

### Current ONNX contract

The exported CTC graph currently uses:

- input `audio_signal`: float tensor `[batch, 80, frames]`;
- input `length`: int64 tensor containing mel frame count;
- output `logprobs`: float tensor `[batch, output_frames, classes]`
  (`output_frames ≈ frames / 4` from encoder subsampling);
- blank class: the final output class (`5632`, with 5633 classes total).

The name `audio_signal` is inherited from NeMo, but the tensor contains log-mel
features, not raw PCM.

### Feature contract

The checkpoint's preprocessor is `AudioToMelSpectrogramPreprocessor` with
`normalize: per_feature`. Client features must reproduce pre-emphasis 0.97, a
symmetric 400-sample hann window centered inside a 512-point FFT, `center=True`
reflect padding, slaney mel filters (80 mels, 0–8000 Hz), `log(x + 2**-24)`, and
per-mel-bin mean/unbiased-std normalization. Omitting normalization makes the
model output only blanks. `apps/native/test/fixtures/mel_golden.json` pins the
Dart implementation to NeMo output.

### Multilingual vocabulary

`vocab.json` is the aggregate tokenizer for 22 Indic languages, 256 tokens each.
Kashmiri occupies ids 2048–2303. When `config.json` provides `vocab_offset` and
`vocab_size`, decoding is restricted to that range plus blank; otherwise all
classes are searched.

`config.json` is the contract between export tooling and Flutter. A model must
not be published if this contract differs from the app implementation.

## Signed manifest

`publish_r2.py` creates a nested manifest payload containing:

- schema and model version;
- minimum application version;
- publication timestamp;
- artifact URL, size, format, and SHA-256;
- per-file SHA-256 values;
- model format and sample rate;
- release notes.

The compact JSON encoding of the nested `manifest` object is signed with
Ed25519. The outer document contains:

```json
{
  "manifest": {},
  "signature": "base64 signature",
  "alg": "ed25519"
}
```

The Flutter app must use the same compact JSON canonicalization when verifying
the signature.

## Flutter application

### Application and routing

`lib/main.dart` creates three BLoCs:

- `ModelDownloadBloc`;
- `RecorderBloc`;
- `TranscriptionBloc`.

`lib/app/router.dart` guards `/record`, `/review`, and `/settings` until a
verified model is active. Model state changes refresh router redirects.

### Model manager

`ManifestClient` downloads and verifies the signed manifest.

`ModelDownloadService` uses `background_downloader` for model transfer.

`ModelStore` owns the on-disk layout:

```text
models/makhzan/
  staging/
  versions/
    VERSION/
      model.onnx
      vocab.json
      config.json
      INSTALL.json
  active.json
```

Install sequence:

1. fetch and verify signed manifest;
2. check connectivity and available storage when possible;
3. download into staging;
4. check declared archive size and SHA-256;
5. extract into the target version directory;
6. verify each file hash;
7. check required files;
8. write `INSTALL.json`;
9. atomically write `active.json`;
10. retain the previous version for rollback and remove older versions.

On failure, the incomplete target is removed and the previous active pointer is
restored.

### Recording

`RecorderService` requests WAV via `record` with:

- encoder `wav`;
- preferred 16 kHz sample rate;
- one channel.

On some platforms (notably macOS) the written file may include a leading
`JUNK` chunk, IEEE float samples, and/or a device sample rate other than
16 kHz. Inference normalizes those files before feature extraction.

`RecorderBloc` handles permission, recording, pause, resume, stop, cancel,
timer, duration limit, amplitude history, silence, and clipping state.

Temporary audio is deleted on discard and after a successful handoff.

### Inference

`CtcInferenceService`:

1. parses RIFF chunks (`fmt ` / `data`), converts to PCM16 mono 16 kHz
   (`wav_pcm.dart`);
2. computes NeMo-equivalent log-mel features in a background isolate
   (`mel_features.dart`: pre-emphasis, centered symmetric hann in a 512-point
   FFT, slaney mel filters, `log(x + 2**-24)`, per-feature normalization);
3. builds ONNX tensors using names from `config.json`;
4. runs ONNX Runtime;
5. performs greedy argmax decoding, restricted to the language's token range
   when `vocab_offset` / `vocab_size` are present;
6. collapses repeated CTC tokens;
7. removes the blank class;
8. converts SentencePiece word markers to spaces;
9. folds Perso-Arabic letters that belong to other languages in the aggregate
   tokenizer onto their Kashmiri equivalents (`kashmiriCharacterFolds`);
10. normalizes whitespace and duplicate ZWNJ.

The current app uses CPU fallback. Optional providers can be listed in model
metadata when supported.

#### Character folding

Because the tokenizer is shared by 22 languages, greedy decoding can emit
Perso-Arabic letters that are not Kashmiri orthography — U+06AA swash kaf,
U+0674 high hamza, and U+0619 small damma. None of them exist in the bundled
Noto Nastaliq Urdu face, so leaving them in a transcript forces a system
fallback font mid-word. That splits the shaping run and neighbouring letters
stop joining; swash kaf is dual-joining, so an entire word comes apart. The web
editor hides the same problem because its CSS falls back to Gulmarg Nastaliq,
which the app does not bundle.

`core/text/kashmiri_orthography.dart` folds them to the characters the on-screen
keyboard produces (U+06A9 keheh, U+0621 hamza, U+064F damma). It is applied both
at the end of decoding (`normalizeKashmiriText`, which also collapses whitespace)
and as an input formatter on the review field
(`KashmiriCharacterFoldingFormatter`), so pasting from another Perso-Arabic
keyboard cannot reintroduce the problem. Folds are one code unit to one code
unit, so caret and selection offsets are unaffected.

`tools/model/scripts/check_font_coverage.py` fails if any codepoint reachable
from the vocabulary is still uncovered after folding, and
`apps/native/test/kashmiri_normalization_test.dart` pins the same rule by
parsing the font's `cmap`.

### Review and handoff

The review page allows correction, retry, and re-recording. The transcript field
uses the bundled Noto Nastaliq Urdu face with RTL direction and a tall line
height (`core/ui/kashmiri_text.dart`), matching the web editor's default font so
text renders the same on both sides of the clipboard handoff. Edits pass through
`KashmiriCharacterFoldingFormatter` so pasted text cannot introduce a character
the face cannot render.

Done:

1. trims the text;
2. copies it to the system clipboard;
3. opens the editor with `?from=makhzan` (default production URL; override with
   `--dart-define=EDITOR_URL=...`);
4. clears the temporary recording after success.

Build-time overrides also include `MANIFEST_URL` and
`MANIFEST_PUBLIC_KEY_B64`. Downloads default to Wi‑Fi only; recordings stop at
120 seconds.

## Release lifecycle

Model archive keys are immutable:

```text
models/makhzan/VERSION/makhzan-VERSION.tar.gz
```

Versioned manifests live beside them. `manifest-latest.json` is the mutable
pointer updated last.

To release:

1. export into a new version directory;
2. validate structure, runtime, accuracy, latency, size, and memory;
3. sign and upload with a new version;
4. confirm public HTTP access;
5. test download and inference in an application build.

To roll back:

1. do not delete the previous archive;
2. republish a signed latest manifest pointing to a known-good version;
3. verify clients can install it;
4. document the reason.

## Known limitations

- Real Kashmiri fixture decoding and CER calculation in
  `validate_export.py` are not implemented yet.
- The current model has passed ONNX load and synthetic-input smoke checks, not
  a representative end-to-end Kashmiri accuracy benchmark.
- Exact NeMo preprocessing parity must be confirmed with deterministic
  fixtures before claiming production-quality recognition.
- Platform integration tests requiring a microphone and real model are not
  automated in CI.
- Windows builds must be produced and tested on Windows.
- App-store signing and distribution require platform developer accounts.

