#!/usr/bin/env python3
"""Validate an exported CTC package against 16 kHz mono fixtures."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    if not ref:
        return 0.0 if not hyp else 1.0
    return levenshtein(ref, hyp) / len(ref)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--fixtures", type=Path, default=Path("fixtures"))
    parser.add_argument("--max-cer", type=float, default=0.45)
    args = parser.parse_args()

    onnx = args.package / "model.onnx"
    cfg_path = args.package / "config.json"
    vocab_path = args.package / "vocab.json"
    for p in (onnx, cfg_path, vocab_path):
        if not p.exists():
            raise SystemExit(f"Missing required file: {p}")

    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    print("Package config:", json.dumps(cfg, indent=2)[:500], "…")

    wavs = sorted(args.fixtures.glob("*.wav"))
    if not wavs:
        print(
            "No fixtures found under",
            args.fixtures,
            "— package structure OK; add .wav+.txt pairs to measure CER.",
        )
        return

    # Full NeMo-parity inference belongs here once export I/O names are known.
    # For now fail loudly if someone claims validation without implementing it.
    raise SystemExit(
        "Fixtures present but validate_export inference hook is not wired yet. "
        "After export, implement CTC decode using config input/output names, "
        f"then assert mean CER <= {args.max_cer}."
    )


if __name__ == "__main__":
    main()
