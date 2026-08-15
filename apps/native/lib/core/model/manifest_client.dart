import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'manifest_keys.dart';
import 'model_manifest.dart';

class ManifestException implements Exception {
  ManifestException(this.message);
  final String message;
  @override
  String toString() => 'ManifestException: $message';
}

class ManifestClient {
  ManifestClient({http.Client? httpClient, String? publicKeyBase64})
      : _http = httpClient ?? http.Client(),
        _publicKeyBase64 = publicKeyBase64 ?? ManifestKeys.publicKeyBase64;

  final http.Client _http;
  final String _publicKeyBase64;

  Future<SignedManifest> fetchLatest({String? url}) async {
    final uri = Uri.parse(url ?? AppConfig.manifestUrl);
    final response = await _http.get(uri);
    if (response.statusCode != 200) {
      throw ManifestException('HTTP ${response.statusCode} fetching manifest');
    }
    return parseAndVerify(response.bodyBytes);
  }

  Future<SignedManifest> parseAndVerify(List<int> bytes) async {
    final root = jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
    final alg = root['alg'] as String? ?? 'ed25519';
    if (alg != 'ed25519') {
      throw ManifestException('Unsupported signature algorithm: $alg');
    }
    final signatureB64 = root['signature'] as String?;
    final manifestJson = root['manifest'];
    if (signatureB64 == null || manifestJson is! Map<String, dynamic>) {
      throw ManifestException('Malformed signed manifest');
    }

    // Canonical body: compact JSON of the nested manifest object only.
    final rawBody = utf8.encode(jsonEncode(manifestJson));
    final ok = await verifySignature(
      message: rawBody,
      signatureBase64: signatureB64,
      publicKeyBase64: _publicKeyBase64,
    );
    if (!ok) {
      throw ManifestException('Manifest signature verification failed');
    }

    return SignedManifest(
      manifest: ModelManifest.fromJson(manifestJson),
      signature: signatureB64,
      alg: alg,
      rawBody: rawBody,
    );
  }

  Future<bool> verifySignature({
    required List<int> message,
    required String signatureBase64,
    required String publicKeyBase64,
  }) async {
    final algorithm = Ed25519();
    final publicKey = SimplePublicKey(
      base64Decode(publicKeyBase64),
      type: KeyPairType.ed25519,
    );
    final signature = Signature(
      base64Decode(signatureBase64),
      publicKey: publicKey,
    );
    return algorithm.verify(message, signature: signature);
  }
}

Uint8List base64Decode(String value) =>
    Uint8List.fromList(base64.decode(value));
