# Maintenance and documentation policy

Use this checklist whenever the project changes. A change is incomplete until
the relevant documentation and tests are updated.

## Source of truth

- Web behavior: `apps/web/src/`, `apps/web/index.html`, `apps/web/style.css`
- Flutter behavior: `apps/native/lib/` and platform folders
- Model contract: generated `config.json`, export script, and
  `CtcInferenceService`
- Release format: `tools/model/scripts/publish_r2.py`
- Audience forks: `docs/GETTING_STARTED.md`
- Deployment matrix: `docs/DEPLOYMENT.md`
- Beginner workflow: `docs/BEGINNER_GUIDE.md`
- Architecture and limitations: `docs/ARCHITECTURE.md`
- Web package: `apps/web/README.md`
- Model operations: `tools/model/README.md` and `tools/model/RELEASE.md`
- Env key names: `tools/model/.env.example`
- Makhzan privacy: `apps/native/docs/PRIVACY.md`

Documentation must describe observed behavior, not intended behavior.

## Documentation required by change type

### Web editor behavior

Update:

- root `README.md` and `apps/web/README.md`;
- `docs/DEPLOYMENT.md` if Vercel Root Directory or build output changed;
- `docs/BEGINNER_GUIDE.md` if setup or user flow changed;
- `docs/ARCHITECTURE.md` if controller/data flow changed;
- web tests under `apps/web/tests/`.

### Fonts or Kashmiri text presentation

Keep the app and web faces aligned. Update `apps/native/README.md`,
architecture, and `apps/native/lib/core/ui/kashmiri_text.dart` together. Bundled fonts must
ship their license file and be registered with `LicenseRegistry`. Verify glyph
coverage for Kashmiri-specific codepoints before switching faces.

### Flutter feature or platform support

Update:

- `apps/native/README.md`;
- `apps/native/docs/PLATFORM_NOTES.md`;
- `apps/native/docs/PRIVACY.md` if audio/clipboard/download promises change;
- beginner run/build commands;
- architecture if states, routes, storage, or inference changed;
- Flutter tests.

### Model preprocessing or ONNX graph

Treat these as a single compatibility contract:

- sample rate and WAV format;
- FFT/window/hop/mel settings;
- input names, types, shapes, and lengths;
- output name, type, and shape;
- vocabulary ordering;
- blank ID;
- token decoding and Unicode normalization.

Update:

- `export_ctc_onnx.py`;
- generated `config.json`;
- `CtcInferenceService`, `mel_features.dart`, and `wav_pcm.dart`;
- model tool documentation;
- architecture;
- deterministic fixtures and expected output.

Re-verify with `tools/model/scripts/verify_features.py` (compare against NeMo,
decode a real clip) and regenerate
`apps/native/test/fixtures/mel_golden.json` in the same change.

Publish a new model version. Never silently overwrite an immutable archive.

### Manifest or signing changes

Update both publisher and client verification together. Add a migration story
for already-installed app versions. Document:

- canonical JSON representation;
- signature algorithm;
- key rotation;
- required and optional fields;
- minimum supported app version.

### Cloudflare R2 changes

Update:

- `tools/model/.env.example` and environment variable documentation;
- public URL examples;
- CORS/range/cache requirements;
- release and rollback procedures.

Never document real write credentials or private keys.

### Dependency or toolchain changes

Update exact minimum versions and rerun clean-environment setup. Prefer commands
that a beginner can copy directly. Record platform-specific limitations.

## Required verification

Web:

```bash
cd apps/web
npm test
npm run build
```

Flutter:

```bash
cd apps/native
flutter analyze
flutter test
```

Model tools:

```bash
cd tools/model
source .venv/bin/activate
python -m compileall scripts
python scripts/validate_export.py --package dist/makhzan-VERSION
```

Release:

```bash
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/manifest-latest.json"
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/VERSION/makhzan-VERSION.tar.gz"
```

Run at least one end-to-end target flow:

```text
download → verify → install → record → transcribe → edit → copy → open → paste
```

## Accuracy claims

Do not call a model “validated,” “accurate,” or “production ready” merely
because:

- ONNX Runtime loads it;
- a synthetic tensor produces logits;
- package hashes pass;
- the UI reaches the review screen.

An accuracy claim requires representative Kashmiri recordings, exact reference
transcripts, a documented CER/WER threshold, and published test results.

The current validation tool does not yet run fixture inference. Keep this
limitation prominent until implemented.

## Secrets and generated artifacts

Never commit:

- `.env` files;
- Hugging Face tokens;
- R2 API keys;
- Ed25519 private keys;
- `.nemo`, `.onnx`, or `.tar.gz` model files;
- Python virtual environments;
- downloaded NeMo source/cache;
- Flutter build output.

Safe to publish:

- Ed25519 public key;
- public manifest URL;
- public model artifact URL;
- hashes and signatures.

Before committing, inspect:

```bash
git status --short
git diff
```

If a secret was committed, removing the line is not enough. Revoke/rotate the
credential immediately and remove it from Git history where appropriate.

## Release notes template

```text
Version:
Date:
App minimum version:
Model source revision:
Export tool versions:
FP32/quantized:
Archive size:
Input/output contract:
Fixture dataset:
Mean CER/WER:
Latency and device:
Peak memory and device:
Known limitations:
Rollback version:
```

## Documentation review checklist

- Commands run from the directory stated in the guide.
- Paths and filenames exist.
- URLs are public URLs, not private API endpoints.
- Placeholder values are clearly labeled.
- No secret value appears in examples.
- Current limitations are explicit.
- The documented behavior matches tests and source.
- New files are linked from an obvious README.
- Platform-specific commands identify the required host OS.
- Release and rollback instructions remain usable.

