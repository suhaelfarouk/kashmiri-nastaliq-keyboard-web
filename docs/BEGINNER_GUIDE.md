# Beginner guide: build, run, and maintain the complete project

This guide explains the whole repository from a clean computer. Follow it in
order the first time. You do not need to understand machine learning before
starting, but model export is resource-intensive and requires access to a gated
Hugging Face model.

If you only need one audience path (web only / run companion / publish model),
start with [`GETTING_STARTED.md`](GETTING_STARTED.md).

## 1. What this repository contains

There are three connected parts:

1. **Web editor** — a Vite application for typing and editing Kashmiri
   Nastaliq Markdown.
2. **Makhzan** — a Flutter application that records speech and performs
   speech-to-text locally.
3. **Model tools** — Python scripts that convert the AI4Bharat NeMo model to
   ONNX, sign it, and publish it to Cloudflare R2.

The normal user flow is:

```text
Flutter app records speech
  → local ONNX model transcribes it
  → user corrects the transcript
  → Done copies text to the device clipboard
  → web editor opens with ?from=makhzan
  → user clicks Paste from Makhzan
```

Audio is not uploaded. The URL never contains the transcript.

## 2. Repository map

```text
.
├── apps/
│   ├── web/                   Vite editor (Vercel)
│   │   ├── index.html style.css src/ public/ tests/
│   │   ├── package.json vite.config.js vercel.json
│   │   └── README.md
│   └── voice/                 Flutter Makhzan
│       ├── lib/ android/ ios/ macos/ windows/ test/
│       └── README.md
├── tools/
│   └── model/                 NeMo → ONNX + R2 publish
│       ├── scripts/ fixtures/
│       └── dist/              Generated; ignored by Git
├── docs/
│   ├── GETTING_STARTED.md
│   ├── DEPLOYMENT.md
│   ├── BEGINNER_GUIDE.md
│   ├── ARCHITECTURE.md
│   └── MAINTENANCE.md
└── README.md
```

Important reading:

- `README.md` — monorepo map and deploy targets
- `docs/DEPLOYMENT.md` — what deploys where
- `apps/web/README.md` — web editor overview
- `apps/native/README.md` — Flutter application details
- `tools/model/README.md` — model conversion instructions
- `tools/model/RELEASE.md` — release, verification, and rollback runbook
- `docs/ARCHITECTURE.md` — data flow and component responsibilities
- `docs/MAINTENANCE.md` — rules for future changes and documentation

## 3. Required software

Install only what you need:

- **Web editor:** Node.js `^20.19.0` or `>=22.12.0` (see `apps/web/package.json` `engines`) and npm
- **Flutter app:** Flutter stable, Android Studio and/or Xcode
- **Model export:** Python 3, Git, and enough disk/RAM
- **Publishing:** a Cloudflare account with R2 enabled
- **iOS/macOS release:** Xcode and an Apple Developer account
- **Windows release:** Windows with Visual Studio C++ desktop tools

Check the basics:

```bash
node --version
npm --version
python3 --version
flutter doctor -v
```

The project was developed with Flutter 3.44.5 and Dart 3.12.2 (FVM on the
author machine; no `.fvmrc` is committed). See
`apps/native/docs/PLATFORM_NOTES.md` for the recorded environment.
Start with audience forks in `docs/GETTING_STARTED.md`.

## 4. Run the web editor

```bash
cd apps/web
npm install
npm start
# http://localhost:8080
```

Open the URL printed by Vite (`http://localhost:8080` with the current
`vite.config.js`).

Run checks:

```bash
cd apps/web
npm test
npm run build
npm run preview
```

The production site is:

```text
https://makhzan-suhael-farouk-s-projects.vercel.app
```

### How the web application starts

1. `src/main.js` calls `initApp`.
2. `src/app.js` creates the editor and UI controllers.
3. `src/ui/editor.js` owns the Tiptap editor.
4. `src/core/transliterator.js` applies phonetic input rules.
5. `src/ui/keyboard.js` handles physical and on-screen keys.
6. `src/ui/autosave.js` stores the draft in browser local storage.
7. `src/ui/makhzan-handoff.js` shows the paste action only for
   `?from=makhzan`.

Clipboard reading requires HTTPS and a user click. If the browser denies
clipboard access, paste manually with Command+V or Ctrl+V.

## 5. Run the Flutter app using the published model

The current manifest is public at:

```text
https://pub-8d441e2513ab4ce1b9addc23585efed2.r2.dev/models/makhzan/manifest-latest.json
```

The manifest URL is the default in `AppConfig`, but the signature public key
must still be supplied at build/run time. The private signing key is never put
in the app.

From the repository root:

```bash
cd apps/native
flutter pub get
flutter analyze
flutter test
flutter devices
```

Run on macOS:

```bash
flutter run -d macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

Run on another target by replacing `macos` with the device ID printed by
`flutter devices` (Android / iOS / Windows / desktop):

```bash
flutter run -d DEVICE_ID \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

Override the manifest and/or local editor for development:

```bash
flutter run -d macos \
  --dart-define=MANIFEST_URL=https://example.com/models/makhzan/manifest-latest.json \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')" \
  --dart-define=EDITOR_URL=http://localhost:8080
```

First-run behavior:

1. The setup page downloads the model archive (**Wi‑Fi only** by default).
2. The app verifies the Ed25519 manifest signature.
3. It verifies archive size and SHA-256.
4. It extracts into a staging/version directory.
5. It verifies the hash of every package file.
6. It writes `INSTALL.json` and atomically changes `active.json`.
7. Recording becomes available (clips stop at **120 seconds**).

The archive is about 435 MB. The extracted ONNX model is about 470 MB, so leave
substantially more free space than the download size.

## 6. Use Makhzan transcription

1. Launch Makhzan.
2. Download the model and wait for **Ready**.
3. Grant microphone permission.
4. Tap **Record** and speak Kashmiri.
5. Pause/resume if needed, then tap **Done**.
6. Review and edit the transcript.
7. Tap **Done** on the review page.
8. The app copies the text and opens the web editor.
9. Click **Paste from Makhzan** in the browser.

If transcription fails, use **Retry** or **Re-record**. If the browser cannot
read the clipboard, paste manually.

## 7. One-time model publisher setup

You only need this section when exporting or publishing a model.

### Hugging Face

1. Log in at `https://huggingface.co`.
2. Accept access terms for:
   `ai4bharat/indicconformer_stt_ks_hybrid_ctc_rnnt_large`.
3. Create a read token at `https://huggingface.co/settings/tokens`.

### Cloudflare R2

1. Create an R2 bucket.
2. Create an R2 API token with Object Read & Write for that bucket.
3. Enable the bucket's public `r2.dev` URL or attach a custom domain.
4. Do not use `*.r2.cloudflarestorage.com` as the public URL; that hostname is
   the private S3 API endpoint.

Copy the example env file and fill in real values (never commit `.env`):

```bash
cd tools/model
cp .env.example .env
```

Edit `.env` so it contains:

```bash
HF_TOKEN=hf_your_token
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_BASE_URL=https://pub-your-id.r2.dev
```

This file is ignored by Git. Never paste its contents into issues, logs,
commits, chat messages, or application source. Scripts do **not** auto-load
`.env`.

Load it in the current terminal:

```bash
cd tools/model
set -a && source .env && set +a
```

The variables remain loaded only in that shell session.

## 8. Generate signing keys once

Create and activate the Python virtual environment:

```bash
cd tools/model
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-publish.txt
```

Generate Ed25519 keys:

```bash
python scripts/gen_signing_keys.py --out-dir ~/.config/makhzan
```

Files created:

- `ed25519_private.key` — signs releases; secret; back it up securely
- `ed25519_public.key` — binary public key
- `ed25519_public.b64` — public key passed to Flutter builds

If the private key is lost, you cannot create updates trusted by installed
builds using its public key. If it is exposed, rotate the key and publish a new
app build that trusts the replacement public key.

## 9. Export the model

Load secrets and activate the environment:

```bash
cd tools/model
set -a && source .env && set +a
source .venv/bin/activate
```

Install the AI4Bharat NeMo fork:

```bash
bash scripts/setup_nemo.sh
```

The setup script uses ASR-only extras. On macOS it skips NVIDIA Triton because
Triton has no macOS wheel. CPU export works but is slower.

Export:

```bash
python scripts/export_ctc_onnx.py \
  --out-dir dist/makhzan-v1.0.0
```

Expected files:

```text
dist/makhzan-v1.0.0/
  model.onnx
  vocab.json
  config.json
```

The current export uses NeMo's CTC branch and the legacy Torch ONNX exporter.
The graph expects log-mel input named `audio_signal` with shape
`[batch, 80, frames]`, an `int64` frame length, and returns `logprobs`.

## 10. Validate before publishing

First perform structural and runtime checks:

```bash
python scripts/validate_export.py --package dist/makhzan-v1.0.0
```

Important current limitation: `validate_export.py` verifies package structure
when no fixtures exist, but its fixture transcription/CER path is not yet
wired. It intentionally fails if `.wav` fixtures are present. Therefore the
current release has passed ONNX loading and synthetic tensor smoke checks, but
it has **not** completed a real Kashmiri fixture CER benchmark.

Do not describe a release as accuracy-validated until the fixture inference
hook is implemented and representative Kashmiri recordings pass an agreed CER
threshold.

For future fixtures, place matching files in `tools/model/fixtures/`:

```text
sample-01.wav   PCM16, mono, 16 kHz
sample-01.txt   exact Perso-Arabic Kashmiri reference text
```

Optional quantization:

```bash
python scripts/quantize_onnx.py \
  --package dist/makhzan-v1.0.0 \
  --out-dir dist/makhzan-v1.0.0-int8
```

Never publish a quantized model solely because it is smaller. Compare its real
Kashmiri CER, latency, and memory use with FP32 first.

## 11. Publish to R2

Choose a new semantic version for every immutable artifact:

```bash
python scripts/publish_r2.py \
  --package dist/makhzan-v1.0.0 \
  --version 1.0.0 \
  --release-notes "Initial Kashmiri CTC ONNX release"
```

The script:

1. creates `dist/makhzan-1.0.0.tar.gz`;
2. hashes the archive and each package file;
3. creates a canonical manifest payload;
4. signs it with the local Ed25519 private key;
5. uploads the immutable archive;
6. uploads the versioned manifest;
7. uploads `manifest-latest.json` last.

Verify both URLs:

```bash
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/manifest-latest.json"
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/1.0.0/makhzan-1.0.0.tar.gz"
```

Both should return HTTP 200. The archive should support `Accept-Ranges: bytes`
for resumable downloads.

## 12. Build release applications

Always include the trusted public key:

```bash
PUBLIC_KEY="$(cat ~/.config/makhzan/ed25519_public.b64)"
```

Android:

```bash
cd apps/native
flutter build appbundle \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
```

macOS:

```bash
flutter build macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
```

iOS:

```bash
flutter build ios \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
```

Windows commands must run on Windows:

```powershell
flutter build windows --dart-define=MANIFEST_PUBLIC_KEY_B64="<public key>"
```

Store signing, notarization, provisioning, and distribution are separate from
model manifest signing.

## 13. Deploy the web editor

Before deployment:

```bash
cd apps/web
npm test
npm run build
```

Deploy from `apps/web/` (or set Vercel Root Directory to `apps/web`):

```bash
cd apps/web
npx vercel
npx vercel --prod
```

Or connect the GitHub repository in Vercel with:

- Root Directory: `apps/web`
- `vercel.json` already sets `framework: null`, `buildCommand`, `outputDirectory`
- Prefer those values over a dashboard Vite preset if they differ
- build command: `npm run build`
- output directory: `dist`

The web application does not need `HF_TOKEN`, R2 write credentials, or the
model signing private key.

## 14. Troubleshooting

### Hugging Face returns 401

- Confirm the token is in `tools/model/.env`, not only `apps/web/.env.local`.
- Confirm it begins with `hf_`.
- Accept the gated model terms with the same account that owns the token.
- Create a new read token if necessary.

### `triton` cannot be installed on macOS

Use `scripts/setup_nemo.sh`; it skips Triton on macOS. Triton is not needed for
CPU CTC export.

### NeMo or PyArrow import fails

Delete `tools/model/.venv` and rerun `scripts/setup_nemo.sh`. See
`tools/model/README.md` for the pinned compatibility packages.

### ONNX export fails in Torch dynamo

Use the repository export script. It forces Torch's legacy ONNX exporter,
which avoids invalid NeMo module names in the dynamo path.

### R2 manifest works through API but not in a browser

`R2_PUBLIC_BASE_URL` must be the public `r2.dev` or custom-domain origin, not
the S3 API hostname ending in `r2.cloudflarestorage.com`.

### Model download fails in the app

- Open the manifest URL in a browser.
- Open the artifact URL from the manifest.
- Check the device has enough free space and a stable connection.
- Confirm the Flutter build used the public key matching the private key that
  signed the manifest.

### Manifest signature verification fails

The public key compiled into the app and private key used by
`publish_r2.py` are not a pair, or the manifest changed after signing. Rebuild
with the correct public key or republish with the matching private key.

### Clipboard paste button is absent

Open the editor with `?from=makhzan`. Clipboard reading requires HTTPS and a
click. Use manual paste if the browser blocks access.

## 15. Security and privacy rules

- Never commit `.env`, private keys, model tokens, or R2 credentials.
  Use `tools/model/.env.example` for key names only.
- Web drafts live in `localStorage` (`makhzan-v1`); there is no
  account store in this app.
- Never put transcript text in URLs, analytics, or logs.
- Never ship the private signing key in Flutter, web assets, CI artifacts, or
  application packages.
- Limit R2 tokens to the model bucket and only required permissions.
- Keep immutable model versions; publish a new version rather than replacing
  an existing archive.
- Treat microphone recordings and transcripts as private user data.
  See `apps/native/docs/PRIVACY.md`.
- Document and test any change to preprocessing, vocabulary, blank ID, model
  inputs, or normalization before publishing.

## 16. Verification checklist

Before merging a web change:

```bash
cd apps/web
npm test
npm run build
```

Before merging a Flutter change:

```bash
cd apps/native
flutter analyze
flutter test
```

Before publishing a model:

- export completes;
- ONNX Runtime loads the graph;
- input/output names and shapes match `config.json`;
- blank ID is correct;
- real Kashmiri fixtures pass the quality gate;
- archive and per-file hashes are generated;
- manifest signature is verified;
- public manifest and artifact URLs return HTTP 200;
- an app build downloads, installs, transcribes, copies, opens, and pastes
  successfully on the target platform.

