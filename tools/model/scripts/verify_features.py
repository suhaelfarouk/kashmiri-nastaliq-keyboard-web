#!/usr/bin/env python3
"""Verify the mel-feature contract shared by NeMo, ONNX, and the Flutter app.

Two jobs:

1. `--wav FILE` compares NeMo's `AudioToMelSpectrogramPreprocessor` output with a
   dependency-light replica of the algorithm the Flutter app implements, then
   decodes the ONNX package with both so a mismatch is visible as text.
2. `--write-golden FILE` writes a deterministic fixture (PCM + NeMo features)
   used by `apps/native/test/mel_features_test.dart`.

Run from `tools/model/` with the virtualenv active. Requires NeMo (see
`scripts/setup_nemo.sh`), numpy, and onnxruntime.
"""

from __future__ import annotations

import argparse
import json
import math
import wave
from pathlib import Path

import numpy as np

# Aggregate tokenizer order in the IndicConformer checkpoint.
LANGS = [
    'as', 'bn', 'brx', 'doi', 'kok', 'gu', 'hi', 'kn', 'ks', 'mai', 'ml',
    'mr', 'mni', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur',
]

SAMPLE_RATE = 16000
N_FFT = 512
WIN_LENGTH = 400
HOP_LENGTH = 160
N_MELS = 80
PREEMPH = 0.97
LOG_GUARD = 2.0 ** -24
NORM_EPS = 1e-5


def read_wav_pcm16_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), 'rb') as handle:
        if handle.getsampwidth() != 2 or handle.getnchannels() != 1:
            raise SystemExit(
                f'{path} must be PCM16 mono (got width={handle.getsampwidth()} '
                f'channels={handle.getnchannels()})'
            )
        rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    return np.frombuffer(raw, dtype='<i2').astype(np.int16), rate


def nemo_features(pcm16: np.ndarray, rate: int) -> tuple[np.ndarray, int]:
    import torch
    from nemo.collections.asr.modules import AudioToMelSpectrogramPreprocessor

    pre = AudioToMelSpectrogramPreprocessor(
        sample_rate=rate,
        normalize='per_feature',
        window_size=WIN_LENGTH / rate,
        window_stride=HOP_LENGTH / rate,
        window='hann',
        features=N_MELS,
        n_fft=N_FFT,
        frame_splicing=1,
        dither=0.0,  # deterministic; training uses 1e-5
        pad_to=0,
    )
    pre.eval()
    wav = pcm16.astype(np.float32) / 32768.0
    with torch.no_grad():
        feats, lens = pre(
            input_signal=torch.tensor(wav).unsqueeze(0),
            length=torch.tensor([len(wav)]),
        )
    return feats.numpy(), int(lens[0])


def slaney_mel_filters(rate: int) -> np.ndarray:
    """Equivalent to librosa.filters.mel defaults (slaney scale + area norm)."""
    f_sp = 200.0 / 3.0
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = math.log(6.4) / 27.0

    def hz_to_mel(hz: float) -> float:
        if hz < min_log_hz:
            return hz / f_sp
        return min_log_mel + math.log(hz / min_log_hz) / logstep

    def mel_to_hz(mel: float) -> float:
        if mel < min_log_mel:
            return mel * f_sp
        return min_log_hz * math.exp(logstep * (mel - min_log_mel))

    mels = np.linspace(hz_to_mel(0.0), hz_to_mel(rate / 2), N_MELS + 2)
    hz = np.array([mel_to_hz(m) for m in mels])
    fftfreqs = np.linspace(0, rate / 2, N_FFT // 2 + 1)

    weights = np.zeros((N_MELS, N_FFT // 2 + 1))
    diff = np.diff(hz)
    ramps = hz[:, None] - fftfreqs[None, :]
    for i in range(N_MELS):
        lower = -ramps[i] / diff[i]
        upper = ramps[i + 2] / diff[i + 1]
        weights[i] = np.maximum(0, np.minimum(lower, upper))
    weights *= (2.0 / (hz[2:N_MELS + 2] - hz[:N_MELS]))[:, None]
    return weights


def replica_features(pcm16: np.ndarray, rate: int) -> tuple[np.ndarray, int]:
    """Mirror of apps/native `mel_features.dart`."""
    x = (pcm16.astype(np.float64) / 32768.0).copy()
    x[1:] -= PREEMPH * x[:-1]

    pad = N_FFT // 2
    padded = np.pad(x, (pad, pad), mode='reflect')
    frames = 1 + len(x) // HOP_LENGTH
    window = np.hanning(WIN_LENGTH)  # symmetric == torch periodic=False
    win_off = (N_FFT - WIN_LENGTH) // 2
    filters = slaney_mel_filters(rate)

    out = np.zeros((N_MELS, frames))
    for t in range(frames):
        seg = padded[t * HOP_LENGTH:t * HOP_LENGTH + N_FFT]
        if len(seg) < N_FFT:
            seg = np.pad(seg, (0, N_FFT - len(seg)))
        buf = np.zeros(N_FFT)
        buf[win_off:win_off + WIN_LENGTH] = seg[win_off:win_off + WIN_LENGTH] * window
        spec = np.fft.rfft(buf)
        out[:, t] = filters @ (spec.real ** 2 + spec.imag ** 2)

    out = np.log(out + LOG_GUARD)
    mean = out.mean(axis=1, keepdims=True)
    std = out.std(axis=1, ddof=1, keepdims=True) + NORM_EPS
    return ((out - mean) / std)[None, :, :].astype(np.float32), frames


def greedy_decode(vocab: list[str], ids: list[int], blank: int) -> str:
    pieces: list[str] = []
    prev = None
    for token in ids:
        if token == prev:
            continue
        prev = token
        if token == blank or token >= len(vocab):
            continue
        piece = vocab[token]
        if piece in {'<unk>', '<pad>', '<blank>', '<blk>'}:
            continue
        pieces.append(piece)
    return ''.join(pieces).replace('\u2581', ' ').strip()


def decode_package(package: Path, feats: np.ndarray, frames: int) -> dict:
    import onnxruntime as ort

    cfg = json.loads((package / 'config.json').read_text())
    vocab = json.loads((package / 'vocab.json').read_text())
    blank = int(cfg['blank_id'])

    session = ort.InferenceSession(
        str(package / cfg.get('onnx_file', 'model.onnx')),
        providers=['CPUExecutionProvider'],
    )
    logits = session.run(None, {
        'audio_signal': feats.astype(np.float32),
        'length': np.array([frames], dtype=np.int64),
    })[0][0]

    full_ids = logits.argmax(-1)
    result = {
        'blank_fraction': float((full_ids == blank).mean()),
        'full_vocab': greedy_decode(vocab, full_ids.tolist(), blank),
    }

    offset = cfg.get('vocab_offset')
    size = cfg.get('vocab_size')
    if offset is None and cfg.get('language_id') in LANGS:
        per_lang = len(vocab) // len(LANGS)
        offset = LANGS.index(cfg['language_id']) * per_lang
        size = per_lang
    if offset is not None and size:
        window = np.concatenate(
            [logits[:, offset:offset + size], logits[:, blank:blank + 1]], axis=1
        )
        local = window.argmax(-1)
        ids = [offset + i if i < size else blank for i in local]
        result['language_slice'] = greedy_decode(vocab, ids, blank)
    return result


def write_golden(path: Path) -> None:
    rng = np.random.default_rng(1234)
    n = 3200  # 0.2 s -> 21 frames
    t = np.arange(n) / SAMPLE_RATE
    signal = (
        0.5 * np.sin(2 * math.pi * 220 * t)
        + 0.25 * np.sin(2 * math.pi * 1400 * t)
        + 0.1 * rng.standard_normal(n)
    )
    pcm16 = np.clip(np.round(signal * 12000), -32768, 32767).astype(np.int16)

    feats, frames = nemo_features(pcm16, SAMPLE_RATE)
    path.write_text(json.dumps({
        'source': 'nemo AudioToMelSpectrogramPreprocessor (dither=0, pad_to=0)',
        'sample_rate': SAMPLE_RATE,
        'n_mels': int(feats.shape[1]),
        'frames': frames,
        'pcm16': pcm16.tolist(),
        'mel': [round(float(v), 6) for v in feats[0, :, :frames].reshape(-1)],
    }))
    print(f'Wrote golden fixture {path} ({feats.shape[1]} mels x {frames} frames)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, help='Exported package directory')
    parser.add_argument('--wav', type=Path, help='PCM16 mono WAV to analyze')
    parser.add_argument('--write-golden', type=Path, help='Write Dart test fixture')
    parser.add_argument('--tolerance', type=float, default=1e-3)
    args = parser.parse_args()

    if args.write_golden:
        write_golden(args.write_golden)

    if not args.wav:
        if not args.write_golden:
            parser.error('pass --wav and/or --write-golden')
        return

    pcm16, rate = read_wav_pcm16_mono(args.wav)
    if rate != SAMPLE_RATE:
        raise SystemExit(f'{args.wav} must be {SAMPLE_RATE} Hz (got {rate})')
    print(f'{args.wav}: {len(pcm16)} samples ({len(pcm16)/rate:.2f}s)')

    nemo_feats, nemo_frames = nemo_features(pcm16, rate)
    rep_feats, rep_frames = replica_features(pcm16, rate)
    if nemo_frames != rep_frames:
        raise SystemExit(f'frame mismatch: nemo={nemo_frames} replica={rep_frames}')

    diff = np.abs(nemo_feats[0, :, :nemo_frames] - rep_feats[0, :, :rep_frames])
    print(f'frames={nemo_frames} max_abs_diff={diff.max():.6f} mean={diff.mean():.6f}')

    if args.package:
        for label, feats, frames in (
            ('nemo', nemo_feats, nemo_frames),
            ('replica', rep_feats, rep_frames),
        ):
            out = decode_package(args.package, feats, frames)
            print(f'\n[{label}] blank frames {out["blank_fraction"]:.1%}')
            print(f'  full vocab     : {out["full_vocab"]!r}')
            if 'language_slice' in out:
                print(f'  language slice : {out["language_slice"]!r}')

    if diff.max() > args.tolerance:
        raise SystemExit(
            f'FAIL: replica differs from NeMo by {diff.max():.6f} '
            f'(> {args.tolerance}); the Flutter implementation must be updated.'
        )
    print('\nOK: replica matches NeMo within tolerance.')


if __name__ == '__main__':
    main()
