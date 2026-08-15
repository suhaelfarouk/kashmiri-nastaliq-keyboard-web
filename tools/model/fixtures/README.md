# Kashmiri transcription fixtures

Add short, consented Kashmiri recordings here to measure model accuracy.
Every recording needs an exact reference transcript with the same basename:

```text
hello.wav
hello.txt
```

Requirements:

- WAV container
- PCM signed 16-bit samples
- mono
- 16,000 Hz
- clear Perso-Arabic Kashmiri transcript in UTF-8
- no personally sensitive speech unless appropriate consent and handling exist

Convert a source recording with ffmpeg:

```bash
ffmpeg -i source.m4a -ac 1 -ar 16000 -c:a pcm_s16le hello.wav
```

Example `hello.txt`:

```text
کٲشُر
```

Include varied speakers, speaking rates, environments, utterance lengths, and
Kashmiri vocabulary. Keep a separate held-out set for final evaluation.

Current limitation: `scripts/validate_export.py` does not yet run inference
over these files. It intentionally fails when fixtures exist so a release
cannot accidentally claim CER validation without implementing the decode path.
