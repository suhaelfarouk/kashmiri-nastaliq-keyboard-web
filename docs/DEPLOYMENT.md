# Deployment

This repository contains three independently deployed units. Do not treat the
git root as a single deployable app.

## What goes where

| Unit | Path | Target | Artifacts |
|------|------|--------|-----------|
| Web editor | `apps/web/` | Vercel | Static site from `apps/web/dist` |
| Makhzan native app | `apps/native/` | App Store / Play / desktop installers | Native binaries; model **not** bundled |
| Model pipeline | `tools/model/` | Cloudflare R2 | Immutable `.tar.gz` + signed manifests |
| Docs | `docs/` | Nowhere | Repository only |

```text
tools/model (HF + R2 write + Ed25519 private key)
  → R2: models/makhzan/<version>/… then manifest-latest.json
  → apps/native (MANIFEST_URL + MANIFEST_PUBLIC_KEY_B64)
  → clipboard + EDITOR_URL/?from=makhzan
  → apps/web on Vercel
```

## 1. Web → Vercel

**Root Directory in the Vercel dashboard:** `apps/web`

Config lives in [`apps/web/vercel.json`](../apps/web/vercel.json):

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- `framework`: `null` (prefer these values over a dashboard Vite preset)

```bash
cd apps/web
npm install
npm test
npm run build
npx vercel        # preview (from apps/web)
npx vercel --prod # or: npm run deploy
```

After moving the web app into this monorepo layout, update the linked Vercel
project Root Directory if it still points at the repository root.

Post-deploy check: open the production URL and confirm `/?from=makhzan` shows
**Paste from Makhzan**.

Production currently uses Vercel Deployment Protection, so visitors must sign
in before reaching the editor. Keep that limitation in mind for native handoff.

## 2. Makhzan → native stores / desktops

Not a Vercel deployment. Build on each host OS:

```bash
cd apps/native
PUBLIC_KEY="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"

flutter build appbundle --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
flutter build ios      --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
flutter build macos    --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
# On Windows:
# flutter build windows --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
```

GitHub Actions can produce test artifacts:

- **Build Windows** → `makhzan-windows`
- **Build Android APKs** → `makhzan-android-apks`

Both require repository secret `MANIFEST_PUBLIC_KEY_B64`. The Android APKs use
debug signing for sideload testing; configure release signing before Play Store
publication.

Optional overrides:

- `MANIFEST_URL` — non-default R2 latest manifest
- `EDITOR_URL` — local web editor (default is production Vercel)

The app downloads the model from R2 at first run (Wi‑Fi only by default).

Post-deploy check: install → download model → record → review Nastaliq text →
Done → paste in the web editor.

## 3. Model → Cloudflare R2

Operator-only. Secrets stay in `tools/model/.env` (gitignored). Scripts do not
auto-load `.env`.

```bash
cd tools/model
source .venv/bin/activate
set -a && source .env && set +a
python scripts/publish_r2.py \
  --package dist/makhzan-vX.Y.Z \
  --version X.Y.Z
```

Publish order (enforced by the script): hash → sign → upload immutable archive →
write `manifest-latest.json` last.

```bash
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/manifest-latest.json"
curl -I "$R2_PUBLIC_BASE_URL/models/makhzan/X.Y.Z/makhzan-X.Y.Z.tar.gz"
```

Both should return HTTP 200. The public base URL must be `r2.dev` or a custom
domain, not `*.r2.cloudflarestorage.com`.

## Recommended release order

1. Export and validate under `tools/model/` (see `RELEASE.md`).
2. Publish to R2.
3. Rebuild `apps/native` with the matching public key.
4. Deploy `apps/web` only if the editor or handoff UX changed.

## Credentials (never commit)

| Secret | Used by |
|--------|---------|
| `HF_TOKEN` | Model download/export |
| `R2_*` | R2 publish |
| `ed25519_private.key` | Manifest signing |
| Vercel login | Web deploy |

Ship only `ed25519_public.b64` into Flutter builds via `--dart-define`.
