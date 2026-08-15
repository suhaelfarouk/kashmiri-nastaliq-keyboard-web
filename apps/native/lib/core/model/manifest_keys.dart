/// Ed25519 public key that verifies R2 model manifests.
///
/// Replace [publicKeyBase64] with the output of
/// `tools/model/scripts/gen_signing_keys.py` before shipping.
class ManifestKeys {
  /// Placeholder: 32 zero bytes, base64. Release builds MUST override this.
  static const publicKeyBase64 = String.fromEnvironment(
    'MANIFEST_PUBLIC_KEY_B64',
    defaultValue: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  );
}
