# Makhzan privacy

## What leaves the device

- Signed model manifest and archive downloads from the public R2 origin.
- The final edited transcript, after the user taps Done, is copied to the
  system clipboard and the public web editor is opened.
- No audio upload endpoint is used by this app.
- Transcript text is not placed in the editor URL.

## What stays local

- Microphone recordings (temporary WAV files).
- ONNX model files after install.
- Intermediate mel features and CTC logits.
- Editable transcript before Done.

Temporary recordings are deleted after discard or a successful Done handoff.

## Browser side

The web editor stores drafts in `localStorage` under `makhzan-v1`.
Clipboard paste on `?from=makhzan` requires:

- HTTPS (or localhost during development);
- an explicit user click on **Paste from Makhzan**.

If the browser denies clipboard access, the user can paste manually.

## Trust notes

- R2 model packages are public. Treat them as open distribution artifacts.
- Manifest authenticity depends on the Ed25519 public key compiled into the
  app build. Use the correct public key for every release.
- Never ship the private signing key, Hugging Face token, or R2 write
  credentials in the app.
