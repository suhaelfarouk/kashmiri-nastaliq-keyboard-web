#!/usr/bin/env python3
"""Pack, hash, sign, and upload a model package to Cloudflare R2."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import tarfile
import time
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--min-app-version", default="1.0.0")
    parser.add_argument(
        "--private-key",
        type=Path,
        default=Path.home() / ".config/makhzan/ed25519_private.key",
    )
    parser.add_argument("--release-notes", default="")
    parser.add_argument(
        "--public-base-url",
        default=None,
        help="Override R2_PUBLIC_BASE_URL (must be a public HTTPS origin, not *.r2.cloudflarestorage.com)",
    )
    args = parser.parse_args()

    required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Missing env: {', '.join(missing)}")
    public_base = (args.public_base_url or os.environ.get("R2_PUBLIC_BASE_URL") or "").rstrip("/")
    if not public_base:
        raise SystemExit("Set R2_PUBLIC_BASE_URL or pass --public-base-url")
    if "r2.cloudflarestorage.com" in public_base:
        raise SystemExit(
            "R2_PUBLIC_BASE_URL is the private S3 API host (*.r2.cloudflarestorage.com).\n"
            "Use your bucket's public URL instead:\n"
            "  - R2.dev subdomain, e.g. https://pub-xxxxx.r2.dev\n"
            "  - or a custom domain, e.g. https://models.yourdomain.com\n"
            "Enable Public access on the bucket in the Cloudflare R2 dashboard, then update tools/model/.env."
        )
    if not args.private_key.exists():
        raise SystemExit(f"Missing private key: {args.private_key}")

    import boto3
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    dist = Path("dist")
    dist.mkdir(parents=True, exist_ok=True)
    archive = dist / f"makhzan-{args.version}.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        for name in ("model.onnx", "vocab.json", "config.json"):
            tar.add(args.package / name, arcname=name)

    digest = sha256_file(archive)
    size = archive.stat().st_size
    object_key = f"models/makhzan/{args.version}/makhzan-{args.version}.tar.gz"
    public_url = public_base + "/" + object_key

    files = {}
    for name in ("model.onnx", "vocab.json", "config.json"):
        files[name] = sha256_file(args.package / name)

    payload = {
        "schemaVersion": 1,
        "modelId": "makhzan",
        "version": args.version,
        "minAppVersion": args.min_app_version,
        "publishedAt": int(time.time()),
        "artifact": {
            "url": public_url,
            "sha256": digest,
            "bytes": size,
            "format": "tar.gz",
        },
        "files": files,
        "modelFormat": "onnx-ctc",
        "sampleRate": 16000,
        "releaseNotes": args.release_notes,
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    private = Ed25519PrivateKey.from_private_bytes(args.private_key.read_bytes())
    signature = private.sign(body)
    signed = {
        "manifest": payload,
        "signature": base64.b64encode(signature).decode("ascii"),
        "alg": "ed25519",
    }

    manifest_path = dist / f"manifest-{args.version}.json"
    latest_path = dist / "manifest-latest.json"
    manifest_path.write_text(json.dumps(signed, indent=2), encoding="utf-8")
    latest_path.write_text(manifest_path.read_text(encoding="utf-8"), encoding="utf-8")

    session = boto3.session.Session()
    s3 = session.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    bucket = os.environ["R2_BUCKET"]
    print(f"Uploading {archive} → s3://{bucket}/{object_key}")
    s3.upload_file(
        str(archive),
        bucket,
        object_key,
        ExtraArgs={"ContentType": "application/gzip", "CacheControl": "public, max-age=31536000, immutable"},
    )
    for local, key in (
        (manifest_path, f"models/makhzan/{args.version}/manifest.json"),
        (latest_path, "models/makhzan/manifest-latest.json"),
    ):
        s3.upload_file(
            str(local),
            bucket,
            key,
            ExtraArgs={"ContentType": "application/json", "CacheControl": "public, max-age=60"},
        )
    print("Published", public_url)
    print("Latest manifest:", public_base + "/models/makhzan/manifest-latest.json")


if __name__ == "__main__":
    main()
