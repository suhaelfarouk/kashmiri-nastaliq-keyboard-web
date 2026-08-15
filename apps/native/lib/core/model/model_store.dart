import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'model_manifest.dart';


/// Local on-disk layout for verified model installs.
class ModelStore {
  Future<Directory> rootDir() async {
    final docs = await getApplicationSupportDirectory();
    final dir = Directory(p.join(docs.path, 'models', 'makhzan'));
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<Directory> stagingDir() async {
    final root = await rootDir();
    final dir = Directory(p.join(root.path, 'staging'));
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<Directory> versionsDir() async {
    final root = await rootDir();
    final dir = Directory(p.join(root.path, 'versions'));
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<File> activePointer() async {
    final root = await rootDir();
    return File(p.join(root.path, 'active.json'));
  }

  Future<Directory> versionDir(String version) async {
    final versions = await versionsDir();
    return Directory(p.join(versions.path, version));
  }

  Future<InstalledModel?> readActive() async {
    final pointer = await activePointer();
    if (!await pointer.exists()) return null;
    final json = jsonDecode(await pointer.readAsString()) as Map<String, dynamic>;
    final version = json['version'] as String;
    final dir = await versionDir(version);
    if (!await dir.exists()) return null;
    final marker = File(p.join(dir.path, 'INSTALL.json'));
    if (!await marker.exists()) return null;
    return InstalledModel(
      version: version,
      directory: dir,
      onnxPath: p.join(dir.path, 'model.onnx'),
      vocabPath: p.join(dir.path, 'vocab.json'),
      configPath: p.join(dir.path, 'config.json'),
    );
  }

  Future<void> writeActive(String version) async {
    final pointer = await activePointer();
    await pointer.writeAsString(
      jsonEncode({'version': version, 'activatedAt': DateTime.now().toIso8601String()}),
    );
  }

  Future<bool> hasVerifiedInstall(String version) async {
    final dir = await versionDir(version);
    final marker = File(p.join(dir.path, 'INSTALL.json'));
    return marker.exists();
  }

  Future<String> sha256File(File file) async {
    final digest = await file.openRead().transform(sha256).single;
    return digest.toString();
  }

  Future<void> verifyPackageFiles({
    required Directory packageDir,
    required ModelManifest manifest,
  }) async {
    for (final entry in manifest.files.entries) {
      final file = File(p.join(packageDir.path, entry.key));
      if (!await file.exists()) {
        throw StateError('Missing package file: ${entry.key}');
      }
      final digest = await sha256File(file);
      if (digest.toLowerCase() != entry.value.toLowerCase()) {
        throw StateError('Hash mismatch for ${entry.key}');
      }
    }
  }

  /// Keep [activeVersion] plus up to [keepPrevious] older installs.
  Future<void> pruneOldVersions({
    required String activeVersion,
    int keepPrevious = 1,
  }) async {
    final versions = await versionsDir();
    final dirs = await versions
        .list()
        .where((e) => e is Directory)
        .cast<Directory>()
        .toList();
    dirs.sort((a, b) => p.basename(b.path).compareTo(p.basename(a.path)));

    final retain = <String>{activeVersion};
    for (final dir in dirs) {
      final name = p.basename(dir.path);
      if (retain.length > keepPrevious) break;
      retain.add(name);
    }
    for (final dir in dirs) {
      final name = p.basename(dir.path);
      if (!retain.contains(name)) {
        await dir.delete(recursive: true);
      }
    }
  }

  /// Best-effort free bytes for [dir]'s filesystem via `df -k`.
  Future<int?> freeBytes(Directory dir) async {
    try {
      final result = await Process.run('df', ['-k', dir.path]);
      if (result.exitCode != 0) return null;
      final lines = (result.stdout as String).trim().split('\n');
      if (lines.length < 2) return null;
      final parts = lines.last.trim().split(RegExp(r'\s+'));
      if (parts.length < 4) return null;
      final availableKb = int.tryParse(parts[3]);
      return availableKb == null ? null : availableKb * 1024;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearStaging() async {
    final staging = await stagingDir();
    if (await staging.exists()) {
      await for (final entity in staging.list()) {
        await entity.delete(recursive: true);
      }
    }
  }
}

class InstalledModel {
  const InstalledModel({
    required this.version,
    required this.directory,
    required this.onnxPath,
    required this.vocabPath,
    required this.configPath,
  });

  final String version;
  final Directory directory;
  final String onnxPath;
  final String vocabPath;
  final String configPath;
}
