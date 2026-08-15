#!/usr/bin/env python3
"""Optional ONNX dynamic quantization. Keep only if CER stays acceptable."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    from onnxruntime.quantization import QuantType, quantize_dynamic

    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    for name in ("vocab.json", "config.json"):
        shutil.copy2(args.package / name, out / name)

    src = args.package / "model.onnx"
    dst = out / "model.onnx"
    print(f"Quantizing {src} → {dst}")
    quantize_dynamic(str(src), str(dst), weight_type=QuantType.QUInt8)

    cfg = json.loads((out / "config.json").read_text(encoding="utf-8"))
    cfg["quantized"] = True
    (out / "config.json").write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print("Done. Re-run validate_export.py before shipping.")


if __name__ == "__main__":
    main()
