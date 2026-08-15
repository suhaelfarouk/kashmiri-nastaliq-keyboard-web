# Model release runbook

This runbook is for maintainers publishing model updates. First-time users
should begin with [`../../docs/BEGINNER_GUIDE.md`](../../docs/BEGINNER_GUIDE.md).

## One-time

1. Accept the Hugging Face model terms and create a read `HF_TOKEN`.
2. Create a Cloudflare R2 bucket and bucket-scoped Object Read & Write token.
3. Enable public R2.dev access or attach a custom domain.
4. Copy [`.env.example`](.env.example) to `.env` and
   fill in: `HF_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_BASE_URL` (public
   `r2.dev` or custom domain — not `*.r2.cloudflarestorage.com`).
5. Generate Ed25519 keys:

```bash
cd tools/model
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-publish.txt
python scripts/gen_signing_keys.py --out-dir ~/.config/makhzan
bash scripts/setup_nemo.sh
```

Scripts do **not** auto-load `.env`. Before export/publish always run
`set -a && source .env && set +a`.

Store the private key securely. Only the base64 public key belongs in app
builds:

```bash
--dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

## Each release

Choose a new semantic version and never overwrite an existing versioned
archive.

```bash
cd tools/model
set -a && source .env && set +a
source .venv/bin/activate

python scripts/export_ctc_onnx.py --out-dir dist/makhzan-vX.Y.Z

# Structural check. Fixture inference is currently not implemented.
python scripts/validate_export.py --package dist/makhzan-vX.Y.Z

# optional quantize + re-validate
python scripts/publish_r2.py \
  --package dist/makhzan-vX.Y.Z \
  --version X.Y.Z \
  --min-app-version 1.0.0 \
  --release-notes "Describe model and compatibility changes"
```

Publish order enforced by `publish_r2.py`: hash → sign → upload immutable archive →
write `manifest-latest.json` last.

## Quality gate

Do not publish based only on package structure. Before a production-quality
claim, record and document:

- representative 16 kHz mono Kashmiri fixtures and reference transcripts;
- mean CER/WER and acceptance threshold;
- FP32 versus quantized accuracy;
- latency and peak memory on each target class;
- ONNX input/output metadata and blank ID;
- a real Flutter end-to-end transcription.

The current `validate_export.py` fixture inference hook is not implemented. It
intentionally fails when fixtures are present. The current v1.0.0 artifact has
passed ONNX load/synthetic-input checks, not a real Kashmiri CER benchmark.

## Post-publish verification

```bash
MANIFEST="$R2_PUBLIC_BASE_URL/models/makhzan/manifest-latest.json"
ARTIFACT="$R2_PUBLIC_BASE_URL/models/makhzan/X.Y.Z/makhzan-X.Y.Z.tar.gz"

curl -I "$MANIFEST"
curl -I "$ARTIFACT"
curl -s "$MANIFEST" | python -m json.tool
```

Confirm:

- both URLs return HTTP 200;
- artifact size matches the manifest;
- `Accept-Ranges: bytes` is available;
- cache headers are short for latest manifest and immutable for the archive;
- a Flutter build with the matching public key downloads and activates it.

## Rollback

Keep the previous archive immutable on R2.

1. Create a correctly signed latest manifest pointing to the known-good
   immutable archive.
2. Upload `manifest-latest.json` last.
3. Verify its signature and public URLs.
4. Test a client update.
5. Document why the release was rolled back.

For local diagnostics, an app can point to a pinned manifest with
`MANIFEST_URL`.

## App install safety

The Flutter app verifies signature, archive SHA-256, per-file hashes, writes
`INSTALL.json`, then flips `active.json`. On failure it restores the previous active
pointer and deletes the broken version directory.

## Key rotation

If the private key is exposed:

1. stop publishing with it;
2. generate a new keypair;
3. release an application update containing the new public key;
4. migrate manifests only after users can receive that app update;
5. revoke/secure publisher credentials and document the incident.

Changing the public key without an app update makes existing builds reject all
new manifests.
