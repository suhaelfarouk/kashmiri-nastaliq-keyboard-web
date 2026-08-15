# Makhzan — model tools

Convert the gated AI4Bharat Kashmiri IndicConformer checkpoint into a
Flutter-friendly **CTC ONNX package**, then publish a signed release to R2.

## Why CTC ONNX

The hybrid NeMo checkpoint cannot run in Flutter as `.nemo`. NeMo can export the
CTC branch as a single ONNX graph (`decoder_type=ctc`), which is what the
companion app downloads and runs with ONNX Runtime.

## Prerequisites

1. Accept the model terms on Hugging Face:
   https://huggingface.co/ai4bharat/indicconformer_stt_ks_hybrid_ctc_rnnt_large
2. `HF_TOKEN` with access to that repo.
3. Python 3.10+ (the current macOS setup used Python 3.12). CUDA is preferred,
   but CPU export works.
4. AI4Bharat NeMo (`nemo-v2` branch) — see `scripts/setup_nemo.sh`.
5. Optional: `ffmpeg` (or another tool) if you prepare your own 16 kHz mono
   fixture WAVs — no pipeline script calls `ffmpeg` automatically.
6. Cloudflare R2 credentials for publishing (`R2_*` env vars).

For a beginner walkthrough from account creation through app builds, read
[`../../docs/BEGINNER_GUIDE.md`](../../docs/BEGINNER_GUIDE.md).

## Local secrets

Copy the example file and fill in real values (never commit `.env`):

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for the exact key names. Scripts do **not**
auto-load `.env`; in each terminal session:

```bash
set -a && source .env && set +a
```

`R2_PUBLIC_BASE_URL` must be the public R2.dev/custom-domain origin. The private
S3 API hostname ending in `r2.cloudflarestorage.com` will not work for app
downloads. `export_ctc_onnx.py` also accepts `HUGGING_FACE_HUB_TOKEN` as an
alias for `HF_TOKEN`.

Never commit or print these secrets.

## Pipeline

```bash
# Run from tools/model/ with the venv active for every step.
# After this directory is moved or renamed, recreate the venv — shebangs and
# editable NeMo installs embed absolute paths:
#   rm -rf .venv && bash scripts/setup_nemo.sh
# or at minimum:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-publish.txt

# Generate the signing keypair once
python scripts/gen_signing_keys.py --out-dir ~/.config/makhzan

# 1. Install NeMo (once)
bash scripts/setup_nemo.sh

# 2. Export CTC ONNX + vocab/config
python scripts/export_ctc_onnx.py \
  --model-id ai4bharat/indicconformer_stt_ks_hybrid_ctc_rnnt_large \
  --out-dir dist/makhzan-v1.0.0

# 3. Structural validation (see the limitation below)
python scripts/validate_export.py --package dist/makhzan-v1.0.0

# 4. Optional safe quantization (only keep if CER stays acceptable)
python scripts/quantize_onnx.py \
  --package dist/makhzan-v1.0.0 \
  --out-dir dist/makhzan-v1.0.0-int8

# 5. Pack, hash, sign, upload to R2, publish latest manifest
python scripts/publish_r2.py \
  --package dist/makhzan-v1.0.0 \
  --version 1.0.0 \
  --release-notes "Initial Kashmiri CTC ONNX release"
```

## Package layout

**Published / exported package** (what `export_ctc_onnx.py` writes under
`dist/` and what `publish_r2.py` archives):

```
makhzan-v1.0.0/
  model.onnx
  vocab.json
  config.json
```

**On-device after install** the Flutter app additionally writes
`INSTALL.json` (and an `active.json` pointer). Do **not** expect
`INSTALL.json` inside the R2 archive.

`config.json` must include sample rate (16000), feature extractor settings, and
CTC blank index so the Flutter decoder matches NeMo.
The current graph contract is:

- `audio_signal`: log-mel float tensor `[batch, 80, frames]` (despite its name);
- `length`: int64 mel frame count;
- `logprobs`: CTC output `[batch, output_frames, classes]` (encoder subsampling
  factor 4, so `output_frames ≈ frames / 4`);
- blank ID: final output class (`5632` for the current graph, 5633 classes).

The export script discovers the actual model filename, forces NeMo's CTC
strategy, uses Torch's legacy ONNX exporter for compatibility, and records
actual ONNX input/output metadata in `config.json`.

### Feature contract (must match NeMo exactly)

The checkpoint's preprocessor is
`AudioToMelSpectrogramPreprocessor` with `normalize: per_feature`. Client
features must reproduce all of:

- pre-emphasis 0.97 (first sample unchanged);
- symmetric hann window of 400 samples, **centered inside** the 512-point FFT;
- `center=True` reflect padding by `n_fft // 2`, frames `1 + samples // 160`;
- power spectrum, `librosa` **slaney** mel filters (80 mels, 0–8000 Hz);
- `log(x + 2**-24)`;
- per-mel-bin mean/unbiased-std normalization (`std + 1e-5`).

Skipping per-feature normalization makes the model emit only blanks. The
Flutter implementation is pinned to a NeMo-generated fixture in
`apps/native/test/fixtures/mel_golden.json`.

### Multilingual vocabulary

The checkpoint uses one aggregate tokenizer for 22 languages
(`as, bn, brx, doi, kok, gu, hi, kn, ks, mai, ml, mr, mni, ne, or, pa, sa, sat,
sd, ta, te, ur`), 256 tokens each. `vocab.json` is that concatenation, so
Kashmiri occupies ids **2048–2303**.

`export_ctc_onnx.py --language-id ks` records `vocab_offset` / `vocab_size` in
`config.json`; the app then restricts greedy decoding to that range plus blank.
Packages exported before this metadata existed still work — decoding falls back
to searching all classes.

## Signing

Generate an Ed25519 keypair once (private key never committed):

```bash
python scripts/gen_signing_keys.py --out-dir ~/.config/makhzan
```

Embed only the **public** key in the Flutter app
using:

```bash
--dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64)"
```

Keep `ed25519_private.key` outside the repository. Back it up securely; losing
it prevents publishing updates trusted by existing builds.

## Fixtures

Place short 16 kHz mono `.wav` clips under `fixtures/` with matching `.txt`
transcripts (Perso-Arabic Kashmiri). These pairs are the intended source for a
future CER/WER quality gate.

### Verify the feature contract

`scripts/verify_features.py` compares NeMo's preprocessor with a replica of the
Flutter algorithm, decodes a WAV through the ONNX package with both, and can
regenerate the Dart test fixture:

```bash
source .venv/bin/activate

# Compare + decode (WAV must be PCM16 mono 16 kHz)
python scripts/verify_features.py \
  --package dist/makhzan-v1.0.0 \
  --wav fixtures/sample.wav

# Regenerate the Flutter golden fixture after any preprocessing change
python scripts/verify_features.py \
  --write-golden ../../apps/native/test/fixtures/mel_golden.json
```

Observed on the development machine: replica versus NeMo `max_abs_diff ≈ 2.5e-5`
and identical decoded text. A high blank-frame percentage with empty output means
the features are wrong (most often missing per-feature normalization), not that
the model failed to load.

### Current validation limitation

`validate_export.py` currently checks that `model.onnx`, `vocab.json`, and
`config.json` exist and prints metadata. If fixtures are present, it
intentionally exits because fixture inference/CER calculation is not wired.

The current export has passed ONNX Runtime loading and synthetic mel-input
smoke checks. It has **not** passed a representative Kashmiri fixture
accuracy benchmark. Implement and pass the fixture hook before claiming
production accuracy or choosing a quantized release.

## Generated output

The current FP32 export is approximately:

- 470 MB uncompressed ONNX;
- 435 MB compressed archive.

`dist/`, `.venv/`, downloaded NeMo source, model binaries, credentials, and
private keys must remain outside Git.

## Verify a published release

```bash
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/manifest-latest.json"
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/1.0.0/makhzan-1.0.0.tar.gz"
```

Both should return HTTP 200. The archive should advertise byte-range support.
