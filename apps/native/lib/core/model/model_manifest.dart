import 'package:equatable/equatable.dart';

class ModelArtifact extends Equatable {
  const ModelArtifact({
    required this.url,
    required this.sha256,
    required this.bytes,
    required this.format,
  });

  final String url;
  final String sha256;
  final int bytes;
  final String format;

  factory ModelArtifact.fromJson(Map<String, dynamic> json) {
    return ModelArtifact(
      url: json['url'] as String,
      sha256: json['sha256'] as String,
      bytes: json['bytes'] as int,
      format: json['format'] as String? ?? 'tar.gz',
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        'sha256': sha256,
        'bytes': bytes,
        'format': format,
      };

  @override
  List<Object?> get props => [url, sha256, bytes, format];
}

class ModelManifest extends Equatable {
  const ModelManifest({
    required this.schemaVersion,
    required this.modelId,
    required this.version,
    required this.minAppVersion,
    required this.publishedAt,
    required this.artifact,
    required this.files,
    required this.modelFormat,
    required this.sampleRate,
    this.releaseNotes = '',
  });

  final int schemaVersion;
  final String modelId;
  final String version;
  final String minAppVersion;
  final int publishedAt;
  final ModelArtifact artifact;
  final Map<String, String> files;
  final String modelFormat;
  final int sampleRate;
  final String releaseNotes;

  factory ModelManifest.fromJson(Map<String, dynamic> json) {
    final filesRaw = json['files'] as Map<String, dynamic>? ?? {};
    return ModelManifest(
      schemaVersion: json['schemaVersion'] as int? ?? 1,
      modelId: json['modelId'] as String? ?? 'makhzan',
      version: json['version'] as String,
      minAppVersion: json['minAppVersion'] as String? ?? '1.0.0',
      publishedAt: json['publishedAt'] as int? ?? 0,
      artifact: ModelArtifact.fromJson(json['artifact'] as Map<String, dynamic>),
      files: filesRaw.map((k, v) => MapEntry(k, v as String)),
      modelFormat: json['modelFormat'] as String? ?? 'onnx-ctc',
      sampleRate: json['sampleRate'] as int? ?? 16000,
      releaseNotes: json['releaseNotes'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'schemaVersion': schemaVersion,
        'modelId': modelId,
        'version': version,
        'minAppVersion': minAppVersion,
        'publishedAt': publishedAt,
        'artifact': artifact.toJson(),
        'files': files,
        'modelFormat': modelFormat,
        'sampleRate': sampleRate,
        'releaseNotes': releaseNotes,
      };

  @override
  List<Object?> get props => [
        schemaVersion,
        modelId,
        version,
        minAppVersion,
        publishedAt,
        artifact,
        files,
        modelFormat,
        sampleRate,
        releaseNotes,
      ];
}

class SignedManifest extends Equatable {
  const SignedManifest({
    required this.manifest,
    required this.signature,
    required this.alg,
    required this.rawBody,
  });

  final ModelManifest manifest;
  final String signature;
  final String alg;

  /// Exact JSON bytes of the nested `manifest` object used for verification.
  final List<int> rawBody;

  @override
  List<Object?> get props => [manifest, signature, alg, rawBody];
}
