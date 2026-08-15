#!/usr/bin/env python3
"""Export AI4Bharat Kashmiri IndicConformer CTC branch to ONNX + metadata."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-id",
        default="ai4bharat/indicconformer_stt_ks_hybrid_ctc_rnnt_large",
    )
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument(
        "--language-id",
        default="ks",
        help="Language key in the aggregate tokenizer used to restrict decoding.",
    )
    args = parser.parse_args()

    if not os.environ.get("HF_TOKEN") and not os.environ.get("HUGGING_FACE_HUB_TOKEN"):
        raise SystemExit(
            "Set HF_TOKEN (or HUGGING_FACE_HUB_TOKEN) after accepting the model terms."
        )

    # Ensure huggingface_hub / NeMo downloads use the token for gated repos.
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    os.environ["HUGGING_FACE_HUB_TOKEN"] = token
    os.environ["HF_TOKEN"] = token
    try:
        from huggingface_hub import login

        login(token=token, add_to_git_credential=False)
    except Exception as exc:  # noqa: BLE001
        print(f"huggingface_hub login warning: {exc}")

    import torch
    import nemo.collections.asr as nemo_asr
    from huggingface_hub import hf_hub_download, list_repo_files

    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    onnx_path = out / "model.onnx"

    # Repo filename may differ from the Hub model id (AI4Bharat uses *_rnnt_large.nemo).
    repo_files = list_repo_files(args.model_id, token=token)
    nemo_files = [f for f in repo_files if f.endswith(".nemo")]
    if not nemo_files:
        raise SystemExit(f"No .nemo file found in {args.model_id}: {repo_files}")
    preferred = next(
        (f for f in nemo_files if "ctc" in f.lower() or "hybrid" in f.lower()),
        nemo_files[0],
    )
    print(f"Downloading {args.model_id}/{preferred} …")
    nemo_path = hf_hub_download(
        repo_id=args.model_id,
        filename=preferred,
        token=token,
        resume_download=True,
    )
    print(f"Loading from {nemo_path} …")
    model = nemo_asr.models.ASRModel.restore_from(nemo_path, map_location="cpu")
    model.freeze()
    model.eval()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    # Prefer CTC graph for a single ONNX file usable on-device.
    if hasattr(model, "change_decoding_strategy"):
        try:
            model.change_decoding_strategy(decoder_type="ctc")
        except Exception as exc:  # noqa: BLE001
            print(f"change_decoding_strategy warning: {exc}")

    if hasattr(model, "set_export_config"):
        model.set_export_config({"decoder_type": "ctc"})

    print(f"Exporting CTC ONNX → {onnx_path}")
    # Torch 2.x defaults to the dynamo exporter, which breaks on NeMo module names like "2".
    # Force the legacy ONNX exporter.
    import torch.onnx as torch_onnx

    _orig_export = torch_onnx.export

    def _legacy_export(*args, **kwargs):
        kwargs.setdefault("dynamo", False)
        return _orig_export(*args, **kwargs)

    torch_onnx.export = _legacy_export  # type: ignore[assignment]
    try:
        model.export(str(onnx_path), onnx_opset_version=args.opset)
    finally:
        torch_onnx.export = _orig_export


    vocab = []
    if hasattr(model, "tokenizer") and model.tokenizer is not None:
        # SentencePiece / BPE style
        tok = model.tokenizer
        if hasattr(tok, "vocab"):
            vocab = list(tok.vocab) if not callable(tok.vocab) else list(tok.vocab())
        elif hasattr(tok, "tokenizer") and hasattr(tok.tokenizer, "get_vocab"):
            vocab = [k for k, _ in sorted(tok.tokenizer.get_vocab().items(), key=lambda x: x[1])]
    elif hasattr(model, "decoder") and hasattr(model.decoder, "vocabulary"):
        vocab = list(model.decoder.vocabulary)

    vocab_path = out / "vocab.json"
    vocab_path.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")

    # IndicConformer uses one aggregate tokenizer covering 22 languages, so the
    # exported vocabulary is a concatenation. Record the requested language's
    # contiguous range so on-device decoding cannot emit another script.
    lang = args.language_id
    vocab_offset = None
    vocab_size = None
    languages = []
    tok = getattr(model, "tokenizer", None)
    offsets = getattr(tok, "token_id_offset", None)
    if isinstance(offsets, dict):
        languages = list(offsets.keys())
        if lang in offsets:
            vocab_offset = int(offsets[lang])
            per_lang = getattr(tok, "tokenizers_dict", {}).get(lang)
            if per_lang is not None and hasattr(per_lang, "vocab_size"):
                vocab_size = int(per_lang.vocab_size)
    if vocab_offset is None:
        print(f"Warning: language '{lang}' not found in tokenizer offsets; decoding will search the full vocabulary.")

    # Record the preprocessor contract the app must reproduce exactly.
    pre_cfg = getattr(getattr(model, "cfg", None), "preprocessor", None)

    def pre_get(key, default):
        try:
            value = pre_cfg[key]
        except Exception:  # noqa: BLE001
            return default
        return default if value is None else value

    sample_rate = int(pre_get("sample_rate", 16000))
    window_size = float(pre_get("window_size", 0.025))
    window_stride = float(pre_get("window_stride", 0.01))

    cfg = {
        "model_id": args.model_id,
        "decoder": "ctc",
        "sample_rate": sample_rate,
        "num_channels": 1,
        "language_id": lang,
        "languages": languages,
        "vocab_offset": vocab_offset,
        "vocab_size": vocab_size,
        "blank_id": getattr(getattr(model, "decoding", None), "blank_id", 0),
        "onnx_file": "model.onnx",
        "vocab_file": "vocab.json",
        "feature": {
            "type": "nemo_mel",
            "n_fft": int(pre_get("n_fft", 512)),
            "win_length": int(round(window_size * sample_rate)),
            "hop_length": int(round(window_stride * sample_rate)),
            "n_mels": int(pre_get("features", 80)),
            "f_min": float(pre_get("lowfreq", 0.0) or 0.0),
            "f_max": float(pre_get("highfreq", sample_rate / 2) or sample_rate / 2),
            "preemph": float(pre_get("preemph", 0.97)),
            "window": str(pre_get("window", "hann")),
            "normalize": str(pre_get("normalize", "per_feature")),
            "log_zero_guard": 2**-24,
            "mel_scale": "slaney",
            "center": True,
            "note": (
                "ONNX input named audio_signal is actually log-mel [B, n_mels, T]; "
                "length is frame count. Features must match NeMo "
                "AudioToMelSpectrogramPreprocessor (symmetric hann window centered in "
                "n_fft, librosa slaney mel filters, log(x + 2**-24), per-feature "
                "mean/std normalization)."
            ),
        },
        "input_names": [],
        "output_names": [],
        "onnx_input_layout": "mel_bct",
    }

    # Probe ONNX I/O names when onnxruntime is available.
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        cfg["input_names"] = [i.name for i in sess.get_inputs()]
        cfg["output_names"] = [o.name for o in sess.get_outputs()]
        cfg["inputs"] = [
            {
                "name": i.name,
                "shape": [int(d) if isinstance(d, int) else str(d) for d in i.shape],
                "type": i.type,
            }
            for i in sess.get_inputs()
        ]
        cfg["outputs"] = [
            {
                "name": o.name,
                "shape": [int(d) if isinstance(d, int) else str(d) for d in o.shape],
                "type": o.type,
            }
            for o in sess.get_outputs()
        ]
        # Multilingual CTC head often uses last logit as blank (V+1 classes).
        for o in sess.get_outputs():
            if o.shape and isinstance(o.shape[-1], int) and o.shape[-1] > len(vocab):
                cfg["blank_id"] = o.shape[-1] - 1
                break
    except Exception as exc:  # noqa: BLE001
        print(f"ONNX probe skipped: {exc}")

    (out / "config.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote package under {out}")
    print("Next: python scripts/validate_export.py --package", out)


if __name__ == "__main__":
    main()
