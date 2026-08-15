import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/core/model/manifest_client.dart';
import 'package:makhzan/core/model/model_manifest.dart';

void main() {
  group('ManifestClient', () {
    late SimpleKeyPair keyPair;
    late String publicKeyB64;
    late ManifestClient client;

    setUp(() async {
      final algorithm = Ed25519();
      keyPair = await algorithm.newKeyPair();
      final publicKey = await keyPair.extractPublicKey();
      publicKeyB64 = base64Encode(publicKey.bytes);
      client = ManifestClient(publicKeyBase64: publicKeyB64);
    });

    Map<String, dynamic> sampleManifest() => {
          'schemaVersion': 1,
          'modelId': 'makhzan',
          'version': '1.0.0',
          'minAppVersion': '1.0.0',
          'publishedAt': 1,
          'artifact': {
            'url': 'https://example.com/model.tar.gz',
            'sha256': 'abc',
            'bytes': 12,
            'format': 'tar.gz',
          },
          'files': {'model.onnx': 'deadbeef'},
          'modelFormat': 'onnx-ctc',
          'sampleRate': 16000,
        };

    Future<List<int>> signedBytes(Map<String, dynamic> manifest) async {
      final body = utf8.encode(jsonEncode(manifest));
      final signature = await Ed25519().sign(body, keyPair: keyPair);
      final root = {
        'alg': 'ed25519',
        'signature': base64Encode(signature.bytes),
        'manifest': manifest,
      };
      return utf8.encode(jsonEncode(root));
    }

    test('accepts a valid Ed25519 signature', () async {
      final bytes = await signedBytes(sampleManifest());
      final signed = await client.parseAndVerify(bytes);
      expect(signed.manifest.version, '1.0.0');
      expect(signed.manifest.artifact.bytes, 12);
    });

    test('rejects a tampered manifest', () async {
      final bytes = await signedBytes(sampleManifest());
      final root = jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
      (root['manifest'] as Map<String, dynamic>)['version'] = '9.9.9';
      final tampered = utf8.encode(jsonEncode(root));
      expect(
        () => client.parseAndVerify(tampered),
        throwsA(isA<ManifestException>()),
      );
    });

    test('rejects wrong public key', () async {
      final bytes = await signedBytes(sampleManifest());
      final other = ManifestClient(
        publicKeyBase64: base64Encode(List<int>.filled(32, 1)),
      );
      expect(
        () => other.parseAndVerify(bytes),
        throwsA(isA<ManifestException>()),
      );
    });
  });

  test('ModelManifest round-trips JSON', () {
    final json = {
      'schemaVersion': 1,
      'modelId': 'makhzan',
      'version': '2.0.0',
      'minAppVersion': '1.0.0',
      'publishedAt': 42,
      'artifact': {
        'url': 'https://example.com/a.tar.gz',
        'sha256': 'ff',
        'bytes': 99,
      },
      'files': {'model.onnx': 'aa', 'vocab.json': 'bb'},
      'modelFormat': 'onnx-ctc',
      'sampleRate': 16000,
      'releaseNotes': 'test',
    };
    final m = ModelManifest.fromJson(json);
    expect(m.toJson()['version'], '2.0.0');
    expect(m.files['vocab.json'], 'bb');
  });
}

String base64Encode(List<int> bytes) => base64.encode(bytes);
