# Makhzan (Flutter companion)

Local, on-device Kashmiri speech-to-text companion for the
[Makhzan](https://makhzan-project.vercel.app)
web editor.

**Package ID:** `com.makhzan`  
**Platforms:** Android, iOS, macOS, Windows

## What it does

1. Downloads a signed CTC ONNX package from Cloudflare R2 (once).
2. Records PCM16 16 kHz mono Kashmiri speech on-device.
3. Runs local ONNX Runtime CTC inference (never uploads audio).
4. Lets you edit the transcript, then **Done** copies text to the system clipboard
   and opens `/?from=makhzan` on the web editor for a user-initiated paste.

## Prerequisites

- Flutter stable (developed with Flutter **3.44.5** / Dart **3.12.2** via FVM
  on the author machine — this repo does **not** ship an `.fvmrc`; any recent
  stable Flutter that satisfies `pubspec.yaml` should work)
- Xcode (iOS/macOS), Android SDK, and Windows build tools as needed
- iOS runs require **iOS 16+** (`flutter_onnxruntime` deployment target)
- macOS runs require **macOS 14+** (`flutter_onnxruntime` deployment target)
- A published model package + signed manifest (see [`../../tools/model/README.md`](../../tools/model/README.md))
- The Ed25519 public key matching the private key used to sign the manifest
  (`~/.config/makhzan/ed25519_public.b64` after `gen_signing_keys.py`)

For audience routing see [`../../docs/GETTING_STARTED.md`](../../docs/GETTING_STARTED.md).
For a first-time, end-to-end walkthrough, read
[`../../docs/BEGINNER_GUIDE.md`](../../docs/BEGINNER_GUIDE.md).
Privacy details: [`docs/PRIVACY.md`](docs/PRIVACY.md).
Platform caveats: [`docs/PLATFORM_NOTES.md`](docs/PLATFORM_NOTES.md).

```bash
flutter doctor -v
flutter devices
```

## Run

The application defaults to the currently published R2 manifest:

```text
https://pub-8d441e2513ab4ce1b9addc23585efed2.r2.dev/models/makhzan/manifest-latest.json
```

Generate signing keys as described in `tools/model/README.md`. Then:

```bash
cd apps/native
flutter pub get
flutter run -d macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

Use `flutter devices` to pick Android / iOS / Windows / macOS. Examples:

```bash
flutter run -d android \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"

flutter run -d windows \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')"
```

Override manifest and/or local editor when needed:

```bash
flutter run -d DEVICE_ID \
  --dart-define=MANIFEST_URL=https://your-public-origin/models/makhzan/manifest-latest.json \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$(cat ~/.config/makhzan/ed25519_public.b64 | tr -d '\n')" \
  --dart-define=EDITOR_URL=http://localhost:8080
```

Do not run a release build without `MANIFEST_PUBLIC_KEY_B64`; the source
default is a zero-byte placeholder and correctly rejects real manifests.

First model download defaults to **Wi‑Fi only** (`wifiOnly: true`). Recording
stops at **120 seconds** (`AppConfig.maxRecordingSeconds`).
## First-run flow

1. The router sends users without a model to `/setup`.
2. **Download model** fetches the signed manifest and archive.
3. The app verifies the signature, archive size/hash, and all package files.
4. It writes an install marker and atomically activates the version.
5. The recorder becomes available.
6. Recording produces a PCM16, mono, 16 kHz temporary WAV.
7. The app extracts log-mel features, runs ONNX Runtime, and greedily decodes
   CTC output.
8. The user edits the transcript and taps **Done**.
9. Text is copied to the clipboard and the web editor opens with
   `?from=makhzan`.
10. The user clicks **Paste from Makhzan** in the browser.

## Kashmiri text rendering

The transcript is shown in **Noto Nastaliq Urdu**, the same default face as the
web editor, so text looks identical before and after the clipboard handoff.
The web editor also offers optional document faces, including a local-installed
Faiz Lahori Nastaleeq preset; those preferences are not part of clipboard text,
and the native review field intentionally remains on the shared Noto default.

- Font bundled at `assets/fonts/NotoNastaliqUrdu-VariableFont_wght.ttf`
  (SIL Open Font License 1.1, `assets/fonts/OFL.txt`, surfaced through
  `LicenseRegistry`).
- Style and RTL wrapper live in `lib/core/ui/kashmiri_text.dart`
  (28 px, line height 2.05, `Locale('ks')`, `TextDirection.rtl`), matching the
  web editor's `--editor-size` and `--editor-leading` in `apps/web/style.css`.
  Keep both sides in step; changing one alone makes the handoff look different.
- The bundled face is a variable font, so the weight axis is pinned to 400
  (`fontVariations`) to match the web editor's regular weight.
- Leading is distributed evenly (`TextLeadingDistribution.even`) so tall
  ascenders and deep descenders are not clipped inside the review text field.
- Nastaliq needs a tall line height; reducing it makes ascenders and descenders
  collide.
- The review field sets `textAlign: right` and `textDirection: rtl` explicitly,
  in addition to the `Directionality` wrapper.
- Verified glyph coverage for the Kashmiri-specific codepoints the on-screen
  keyboard produces, including `U+0672 ٲ`, `U+06CD ۍ`, `U+06C4 ۄ`, `U+0620 ؠ`,
  and the vowel marks `U+065A`, `U+065B`, `U+065D`–`U+065F`. The face does
  **not** cover `U+065C`, which the keyboard and the model never emit.

### Characters that break joining

A codepoint missing from the bundled face falls back to a system font in the
middle of a word. That splits the shaping run, so the letters around it stop
joining — very visible in Nastaliq, and the reason a word can appear broken in
the app but correct on the web (the web CSS falls back to Gulmarg Nastaliq,
which is not bundled here).

Two paths bring such characters in: the aggregate tokenizer is shared by 22
languages, so greedy decoding can emit Perso-Arabic letters that are neither
Kashmiri orthography nor present in the face, and a user can type or paste them
from a system keyboard. `kashmiriCharacterFolds` in
`lib/core/text/kashmiri_orthography.dart` folds them onto the keyboard's
equivalents:

| Model may emit | Folded to | Why |
| --- | --- | --- |
| `U+06AA ڪ` swash kaf | `U+06A9 ک` keheh | dual-joining, so it breaks a whole word |
| `U+0674 ٴ` high hamza | `U+0621 ء` hamza | not in the face |
| `U+0619 ؙ` small damma | `U+064F ُ` damma | combining mark not in the face |

Folding is applied in two places:

- `normalizeKashmiriText` at the end of CTC decoding, which also collapses
  whitespace and trims;
- `KashmiriCharacterFoldingFormatter` on the review field, so typed and pasted
  text is folded too. It only folds — collapsing whitespace here would break the
  space key. Folds are one code unit to one code unit, so the caret, selection,
  and composing range survive unchanged.

Guardrails, both of which fail if a new uncovered codepoint becomes reachable:

```bash
# From the repo root: checks the vocabulary against the bundled face.
python3 tools/model/scripts/check_font_coverage.py \
  --vocab tools/model/dist/makhzan-v1.0.0/vocab.json

# From apps/native: parses the font cmap and pins the folds.
flutter test test/kashmiri_normalization_test.dart
```

When changing the bundled font, rerun both. If the new face covers a folded
character, drop the fold — the test asserts folds exist only for genuinely
missing glyphs.

## Architecture

```
lib/
  app/router.dart              # go_router + model-ready guards
  core/config/               # URLs + constants
  core/ui/kashmiri_text.dart # Nastaliq style + RTL wrapper
  core/text/                 # orthography folds + input formatter
  core/model/                # signed manifest, store, Ed25519 verify
  features/model_manager/   # resumable download / verify / atomic install
  features/recorder/        # PCM16 WAV + waveform UX
  features/transcription/    # mel features + ONNX CTC
  features/handoff/         # clipboard + open editor
```

Recording is blocked until a verified model install exists (`INSTALL.json` + active pointer).

The current archive is about 435 MB and the ONNX file is about 470 MB. Allow
extra free space for the archive, staging extraction, active model, and
rollback copy.

## Model delivery

- Manifest is Ed25519-signed; the app embeds only the **public** key
  (`MANIFEST_PUBLIC_KEY_B64` / `ManifestKeys`).
- Downloads use `background_downloader` with pause/resume, Wi-Fi-only option,
  retries with jitter, staging → hash verify → extract → per-file hashes →
  smoke file presence → `INSTALL.json` → atomic `active.json` pointer.
- Previous version is kept for rollback; older installs are pruned.

## Privacy

- Audio stays on device and temp WAVs are deleted after discard or successful Done.
- Transcript text is never put in the editor URL, logs, or analytics by this app.
- See [`docs/PRIVACY.md`](docs/PRIVACY.md) for the full summary.
## Tests

```bash
flutter test
flutter analyze
```

The unit suite covers configuration, manifest signature acceptance/rejection,
mel feature shape, and transcription state transitions. Real microphone,
background-download recovery, device ONNX inference, clipboard, and URL-launch
integration tests still require manual testing on each target OS.

The exported package lives under `tools/model/dist/`, which is ignored by Git.
See [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for the current model
I/O contract and explicit validation limitations.

## Build examples

```bash
PUBLIC_KEY="$(cat ~/.config/makhzan/ed25519_public.b64)"

flutter build appbundle \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"

flutter build macos \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"

flutter build ios \
  --dart-define=MANIFEST_PUBLIC_KEY_B64="$PUBLIC_KEY"
```

Build Windows on Windows:

```powershell
flutter build windows --dart-define=MANIFEST_PUBLIC_KEY_B64="<public key>"
```

### CI build artifacts

GitHub Actions builds Windows and Android test artifacts on `main` when
`apps/native/` changes, and on demand:

1. Add repository secret `MANIFEST_PUBLIC_KEY_B64` (contents of
   `~/.config/makhzan/ed25519_public.b64`, no newlines).
2. **Actions → Build Windows → Run workflow** produces **makhzan-windows**.
   Unzip and run `makhzan.exe`, keeping its DLL/data folders beside it.
3. **Actions → Build Android APKs → Run workflow** produces
   **makhzan-android-apks**, containing a universal APK and smaller per-ABI
   APKs. Use `app-release.apk` for the simplest sideload test.

Workflows:
[Windows](../../.github/workflows/build-windows.yml) and
[Android](../../.github/workflows/build-android.yml).

The Android APKs currently use Flutter's debug signing key and are for
sideload testing only, not Play Store publication.

### GitHub Releases

Pushing a version tag such as `v1.0.0` runs
[`publish-native-release.yml`](../../.github/workflows/publish-native-release.yml).
After Windows and Android tests/builds pass, it creates a permanent GitHub
prerelease containing the Windows zip plus universal and per-ABI APKs.

Releases are marked as prereleases while Android uses debug signing. Do not
promote one to a stable store release until Android release signing and
target-device checks are complete.

Platform store signing/provisioning is separate from Ed25519 model signing.

## Troubleshooting

- **Manifest signature failed:** rebuild with the public key matching the
  publisher's private key.
- **Model URL is inaccessible:** use an R2 public `r2.dev` or custom-domain
  URL, not `*.r2.cloudflarestorage.com`.
- **Recording remains locked:** confirm the download reached Ready and the
  device has enough free space.
- **Clipboard paste fails:** use HTTPS, click the browser button, grant
  clipboard permission, or paste manually.
- **Transcript comes back empty:** the mel features no longer match NeMo, so
  every frame decodes to blank. Run
  `python scripts/verify_features.py --package <dist dir> --wav <clip>` in
  `tools/model/`, then `flutter test test/mel_features_test.dart`.
- **`Expected PCM16 mono 16 kHz WAV`:** older builds read a fixed 44-byte
  header. Current code parses RIFF chunks and converts float/other rates, so
  update the app if this reappears.
- **Transcription quality is poor:** do not tune around individual recordings;
  first add representative fixtures and compare preprocessing with NeMo.
