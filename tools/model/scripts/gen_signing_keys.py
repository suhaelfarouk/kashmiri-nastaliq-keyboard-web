#!/usr/bin/env python3
"""Generate Ed25519 signing keys. Private key must never be committed."""

from __future__ import annotations

import argparse
import base64
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    private = Ed25519PrivateKey.generate()
    public = private.public_key()
    priv_bytes = private.private_bytes_raw()
    pub_bytes = public.public_bytes_raw()

    (args.out_dir / "ed25519_private.key").write_bytes(priv_bytes)
    (args.out_dir / "ed25519_public.key").write_bytes(pub_bytes)
    (args.out_dir / "ed25519_public.b64").write_text(
        base64.b64encode(pub_bytes).decode("ascii") + "\n", encoding="utf-8"
    )
    print("Wrote keys to", args.out_dir)
    print("Public (base64):", base64.b64encode(pub_bytes).decode("ascii"))
    print("Embed the public key in apps/native/lib/core/model/manifest_keys.dart")


if __name__ == "__main__":
    main()
