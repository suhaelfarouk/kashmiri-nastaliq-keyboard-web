import 'dart:convert';
import 'dart:io';

import 'package:archive/archive_io.dart';
import 'package:background_downloader/background_downloader.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:path/path.dart' as p;

import '../../../core/config/app_config.dart';
import '../../../core/model/manifest_client.dart';
import '../../../core/model/model_manifest.dart';
import '../../../core/model/model_store.dart';

enum ModelInstallPhase {
  idle,
  checking,
  downloading,
  verifying,
  installing,
  ready,
  failed,
}

class ModelDownloadService {
  ModelDownloadService({
    ManifestClient? manifestClient,
    ModelStore? store,
    FileDownloader? downloader,
    Connectivity? connectivity,
  })  : _manifests = manifestClient ?? ManifestClient(),
        _store = store ?? ModelStore(),
        _downloader = downloader ?? FileDownloader(),
        _connectivity = connectivity ?? Connectivity();

  final ManifestClient _manifests;
  final ModelStore _store;
  final FileDownloader _downloader;
  final Connectivity _connectivity;

  ModelStore get store => _store;

  Stream<TaskUpdate> get updates => _downloader.updates;

  Future<void> trackTasks() => _downloader.trackTasks();

  Future<InstalledModel?> current() => _store.readActive();

  Future<SignedManifest> fetchManifest() => _manifests.fetchLatest();

  Future<bool> wifiOnlyOk({required bool wifiOnly}) async {
    if (!wifiOnly) return true;
    final results = await _connectivity.checkConnectivity();
    return results.any((r) => r == ConnectivityResult.wifi);
  }

  Future<DownloadTask> enqueueDownload({
    required ModelManifest manifest,
    required bool wifiOnly,
  }) async {
    final staging = await _store.stagingDir();
    final filename = 'makhzan-${manifest.version}.tar.gz';
    final task = DownloadTask(
      url: manifest.artifact.url,
      filename: filename,
      directory: staging.path,
      baseDirectory: BaseDirectory.root,
      group: AppConfig.downloadTaskGroup,
      updates: Updates.statusAndProgress,
      retries: 5,
      allowPause: true,
      requiresWiFi: wifiOnly,
      metaData: manifest.version,
    );

    final enqueued = await _downloader.enqueue(task);
    if (!enqueued) {
      throw StateError('Failed to enqueue model download');
    }
    return task;
  }

  Future<void> pause(DownloadTask task) => _downloader.pause(task);
  Future<void> resume(DownloadTask task) => _downloader.resume(task);
  Future<void> cancel(DownloadTask task) => _downloader.cancel(task);

  /// Verify archive hash, extract, verify files, write INSTALL marker, activate.
  Future<InstalledModel> installFromArchive({
    required File archive,
    required ModelManifest manifest,
  }) async {
    final size = await archive.length();
    if (size != manifest.artifact.bytes) {
      throw StateError('Archive size mismatch: $size vs ${manifest.artifact.bytes}');
    }
    final digest = await _store.sha256File(archive);
    if (digest.toLowerCase() != manifest.artifact.sha256.toLowerCase()) {
      throw StateError('Archive SHA-256 mismatch');
    }

    final previous = await _store.readActive();
    final target = await _store.versionDir(manifest.version);
    if (await target.exists()) {
      await target.delete(recursive: true);
    }
    await target.create(recursive: true);

    try {
      await extractFileToDisk(archive.path, target.path);
      await _store.verifyPackageFiles(packageDir: target, manifest: manifest);

      final onnx = File(p.join(target.path, 'model.onnx'));
      if (!await onnx.exists()) {
        throw StateError('model.onnx missing after extract');
      }

      final marker = File(p.join(target.path, 'INSTALL.json'));
      await marker.writeAsString(
        jsonEncode({
          'version': manifest.version,
          'installedAt': DateTime.now().toIso8601String(),
          'artifactSha256': manifest.artifact.sha256,
        }),
      );

      await _store.writeActive(manifest.version);
      await _store.pruneOldVersions(activeVersion: manifest.version, keepPrevious: 1);
      await _store.clearStaging();

      return InstalledModel(
        version: manifest.version,
        directory: target,
        onnxPath: p.join(target.path, 'model.onnx'),
        vocabPath: p.join(target.path, 'vocab.json'),
        configPath: p.join(target.path, 'config.json'),
      );
    } catch (e) {
      if (await target.exists()) {
        await target.delete(recursive: true);
      }
      if (previous != null) {
        await _store.writeActive(previous.version);
      }
      rethrow;
    }
  }
}
