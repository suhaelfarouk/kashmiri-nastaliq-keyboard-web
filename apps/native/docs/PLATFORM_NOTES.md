# Platform notes

Use this as an actionable checklist, not only a machine snapshot.

## Development-machine snapshot (2026-08-15)

- Flutter 3.44.5 stable / Dart 3.12.2 (FVM-managed on the author machine;
  this repo does not commit `.fvm` / `.fvmrc`)
- Android, iOS, macOS, Windows targets enabled
- `flutter doctor`: no issues found
- Android SDK 37; licenses accepted
- Xcode 26.6; CocoaPods 1.16.2

Wireless iPhone discovery can fail until the phone is unlocked, connected or
paired, and Developer Mode is enabled.

## Required permissions

- Android: microphone, internet, notification, and data-sync foreground service
- iOS: microphone usage description (`NSMicrophoneUsageDescription`)
- macOS: microphone entitlement, client networking, and sandbox permissions
- Windows: microphone access must be allowed in Windows privacy settings

Grant mic access on first record. Without it, recording fails closed.

## Model download UX

- Default download is **Wi‑Fi only** (`wifiOnly: true`). Cellular/metered
  networks are rejected until that policy is changed in code/settings.
- Archive is ~435 MB; leave room for staging + extract + previous version.
- Prefer plugged-in power on mobile for the first install.

## Recording limits

- Max clip length: **120 seconds** (`AppConfig.maxRecordingSeconds`).
- Requested sample rate: PCM16 mono 16 kHz via `record`.
- Inference accepts non-canonical WAVs (JUNK padding, float32, other rates)
  and converts them to PCM16 mono 16 kHz before mel extraction.

## Editor handoff

Default editor is production Vercel. For local web testing:

```bash
--dart-define=EDITOR_URL=http://localhost:8080
```

Clipboard paste still needs a user click on **Paste from Makhzan**.

## Background-download behavior

- iOS uses platform background-transfer facilities and may defer large work
  based on system conditions. Prefer Wi-Fi and external power.
- Android uses the `background_downloader` plugin and data-sync foreground
  service permissions.
- Desktop platforms require the process to remain available; do not assume the
  same suspended-app guarantees as mobile.

Always test pause, resume, process restart, network loss, low disk space, and
hash failure on real devices before release.

## Build host requirements

- Android builds: macOS, Windows, or Linux with Android SDK
- iOS builds: macOS with Xcode and Apple signing
- macOS builds: macOS with Xcode; **minimum deployment target 14.0**
  (required by `flutter_onnxruntime`; set in
  `macos/Runner.xcodeproj/project.pbxproj`)
- Windows builds: Windows with Visual Studio desktop C++ tools
- CI Windows zip: `.github/workflows/build-windows.yml` on `windows-latest`
  (requires secret `MANIFEST_PUBLIC_KEY_B64`; artifact `makhzan-windows`)
- CI Android APKs: `.github/workflows/build-android.yml` on `ubuntu-latest`
  (artifact `makhzan-android-apks`; debug-signed for sideload testing)
- Permanent native prereleases:
  `.github/workflows/publish-native-release.yml` on `v*` tags (Windows zip and
  Android APK assets; requires `MANIFEST_PUBLIC_KEY_B64`)

## Current integration-test status

Unit tests and static analysis run locally. Real-device automated integration
coverage for microphone permission, background recovery, ONNX inference,
clipboard, and URL launching is not yet present. Perform the end-to-end manual
check described in `docs/BEGINNER_GUIDE.md` on every release target.
