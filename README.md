# Makhzan (monorepo)

Makhzan ships through three delivery units in one repository. Each has its own
toolchain and deploy target.

| Unit | Path | Deploy to |
|------|------|-----------|
| Web editor | [`apps/web/`](apps/web/) | **Vercel** (`dist/`) |
| Makhzan | [`apps/native/`](apps/native/) | Native builds (Android / iOS / macOS / Windows) |
| Model pipeline | [`tools/model/`](tools/model/) | **Cloudflare R2** (signed ONNX packages) |

Shared docs live in [`docs/`](docs/). Start with
[`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) or
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Protected live editor (Vercel login required):
[https://makhzan-suhael-farouk-s-projects.vercel.app](https://makhzan-suhael-farouk-s-projects.vercel.app)

## Quick starts

### Web (Vercel)

```bash
cd apps/web
npm install
npm start          # http://localhost:8080
npm test
npm run build     # → apps/web/dist
```

Vercel project **Root Directory** must be `apps/web`. See
[`apps/web/README.md`](apps/web/README.md).

### Native app

```bash
cd apps/native
flutter pub get
flutter run -d macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

Not deployed to Vercel. See [`apps/native/README.md`](apps/native/README.md).

### Model export / publish (R2)

```bash
cd tools/model
source .venv/bin/activate   # recreate venv after a path move if needed
set -a && source .env && set +a
python scripts/publish_r2.py --package dist/makhzan-v1.0.0 --version 1.0.0
```

Operator-only. See [`tools/model/README.md`](tools/model/README.md) and
[`tools/model/RELEASE.md`](tools/model/RELEASE.md).

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — what goes where
- [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) — audience forks
- [`docs/BEGINNER_GUIDE.md`](docs/BEGINNER_GUIDE.md) — full walkthrough
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data flow and contracts
- [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) — keep docs in sync

## Repository layout

```text
apps/
  web/                 Vite Kashmiri Nastaliq Markdown editor → Vercel
  native/              Flutter on-device STT app
tools/
  model/               NeMo → ONNX export, sign, R2 publish
docs/                  Shared architecture and runbooks
README.md              This file
```

## Flow

```text
tools/model → signed package on R2
  → apps/native downloads + verifies → local CTC transcription
  → clipboard → apps/web /?from=makhzan → Paste from Makhzan
```

Audio stays on device. The editor URL never contains the transcript.
