#!/usr/bin/env bash
# Install AI4Bharat NeMo (nemo-v2) into .venv for CTC ONNX export.
# On macOS, Triton is skipped (no CUDA wheels); ASR export still works on CPU.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip wheel
python -m pip install \
  "setuptools<81" \
  "huggingface_hub>=0.23" \
  onnx \
  onnxscript \
  onnxruntime \
  soundfile \
  numpy

if [[ ! -d NeMo ]]; then
  git clone https://github.com/AI4Bharat/NeMo.git
fi
cd NeMo
git fetch --all
git checkout nemo-v2

# Triton has no macOS ARM wheels; strip it so install can proceed.
if [[ "$(uname -s)" == "Darwin" ]]; then
  if grep -q '^triton$' requirements/requirements.txt 2>/dev/null; then
    sed -i.bak 's/^triton$/# triton  # skipped on macOS/' requirements/requirements.txt
  fi
fi

python -m pip uninstall -y nemo_toolkit sacrebleu nemo_asr nemo_nlp nemo_tts || true

# ASR-only extras — enough for IndicConformer CTC ONNX export (lighter than [all]).
python -m pip install --editable ".[asr]"

# NeMo 1.23's imports are incompatible with the newest Lightning/PyArrow
# releases. Keep the known-good range used for this export.
python -m pip install \
  "setuptools<81" \
  "pytorch-lightning>=2.2.1,<2.4" \
  "pyarrow>=14,<18"

# Fail during setup instead of later during a long export.
python -c "import nemo.collections.asr; print('NeMo ASR import: OK')"

echo "NeMo ready. Activate with: source tools/model/.venv/bin/activate"
