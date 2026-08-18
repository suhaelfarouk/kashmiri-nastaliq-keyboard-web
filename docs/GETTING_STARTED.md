# Getting started paths

Choose the smallest path that matches your goal. For “what deploys
where”, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Path A — use the web keyboard only

Goal: type Kashmiri Nastaliq in the browser and save `.docx` files.

1. Install Node.js `^20.19` or `>=22.12`.
2. Follow [`../apps/web/README.md`](../apps/web/README.md).
3. From `apps/web/`, run `npm test` if you change web code.
4. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the Vercel Root Directory.

You do **not** need Flutter, Hugging Face, R2 credentials, or model keys.

## Path B — run Makhzan with the published model

Goal: record speech, transcribe locally, paste into the web editor.

1. Install Flutter and a device/toolchain (`flutter doctor -v`).
2. Read [`../apps/native/README.md`](../apps/native/README.md).
3. Supply the matching public signing key:

```bash
cd apps/native
flutter run -d macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64)"
```

4. Download the model in-app, record, review, tap Done, then paste in the
   browser.

You need the public key that signed the published manifest. You do **not**
need Hugging Face or R2 write credentials to consume a published model.

## Path C — export and publish a new model release

Goal: convert the gated AI4Bharat checkpoint and publish a signed package.

1. Accept Hugging Face model terms and create a read token.
2. Create R2 credentials and a public download origin.
3. Follow [`../tools/model/README.md`](../tools/model/README.md) and
   [`../tools/model/RELEASE.md`](../tools/model/RELEASE.md).
4. Use [`BEGINNER_GUIDE.md`](BEGINNER_GUIDE.md) for the full
   copyable sequence and troubleshooting.

This path needs secrets. Never commit them.

## Privacy summary

- Web drafts stay in browser `localStorage`.
- Flutter audio stays on device and is deleted after discard or successful Done.
- Transcript reaches the web editor only through the system clipboard after a
  user-initiated paste.
- Model archives on R2 are public by design; they must not contain secrets or
  private user data.

See [`../apps/native/docs/PRIVACY.md`](../apps/native/docs/PRIVACY.md).
