import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_onnxruntime/flutter_onnxruntime.dart';

import '../../../core/model/model_store.dart';
import '../../../core/text/kashmiri_orthography.dart';
import 'mel_features.dart';
import 'wav_pcm.dart';

/// Fold letters the face cannot render, collapse whitespace, drop duplicate ZWNJ.
///
/// Decode-time only: collapsing whitespace and trimming would stop the user
/// typing spaces, so the review field applies just the folds via
/// [KashmiriCharacterFoldingFormatter].
String normalizeKashmiriText(String text) {
  return foldKashmiriCharacters(text)
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceAll('\u200c\u200c', '\u200c')
      .trim();
}

/// Local CTC inference over a verified ONNX package.
///
/// Runs feature extraction off the UI isolate, then ONNX Runtime on CPU
/// (with optional CoreML/NNAPI providers when listed in config).
class CtcInferenceService {
  OrtSession? _session;
  List<String> _vocab = const [];
  Map<String, dynamic> _config = const {};
  MelFeatureConfig _melConfig = const MelFeatureConfig();
  InstalledModel? _model;
  int _blankId = 0;

  /// IndicConformer uses one aggregate tokenizer for 22 languages. When the
  /// export records the Kashmiri range, decoding is restricted to it so other
  /// scripts cannot appear; otherwise the full vocabulary is searched.
  int? _vocabOffset;
  int? _vocabSize;

  InstalledModel? get model => _model;

  Future<void> load(InstalledModel model) async {
    await dispose();
    final vocabRaw = await File(model.vocabPath).readAsString();
    _vocab = (jsonDecode(vocabRaw) as List).map((e) => e.toString()).toList();
    _config = jsonDecode(await File(model.configPath).readAsString()) as Map<String, dynamic>;
    _melConfig = MelFeatureConfig.fromJson(_config);
    _blankId = (_config['blank_id'] as int?) ?? 0;
    _vocabOffset = _config['vocab_offset'] as int?;
    _vocabSize = _config['vocab_size'] as int?;

    final providers = <OrtProvider>[OrtProvider.CPU];
    final preferred = (_config['providers'] as List?)?.cast<String>() ?? const [];
    for (final name in preferred) {
      final match = OrtProvider.values.where((p) => p.name.toLowerCase() == name.toLowerCase());
      if (match.isNotEmpty && !providers.contains(match.first)) {
        providers.insert(0, match.first);
      }
    }

    final ort = OnnxRuntime();
    _session = await ort.createSession(
      model.onnxPath,
      options: OrtSessionOptions(providers: providers),
    );
    _model = model;
  }

  Future<String> transcribeWav(String wavPath) async {
    final session = _session;
    if (session == null) {
      throw StateError('Model session not loaded');
    }
    final pcm = await _readWavPcm16Mono16k(wavPath);
    if (pcm.isEmpty) {
      throw StateError('Empty audio');
    }

    final mel = await compute(_melIsolate, _MelArgs(pcm, _melConfig));
    if (mel.frames == 0) {
      throw StateError('Audio too short for mel features');
    }

    final inputs = await _buildInputs(session, pcm: pcm, mel: mel);
    try {
      final outputs = await session.run(inputs);
      try {
        final primary = outputs[session.outputNames.first]!;
        final data = await primary.asFlattenedList();
        final tokenIds = _greedyCtcFromLogits(data, primary.shape);
        return decodeCtc(tokenIds);
      } finally {
        for (final value in outputs.values) {
          await value.dispose();
        }
      }
    } finally {
      for (final value in inputs.values) {
        await value.dispose();
      }
    }
  }

  Future<Map<String, OrtValue>> _buildInputs(
    OrtSession session, {
    required List<int> pcm,
    required MelFeatures mel,
  }) async {
    final configured = (_config['input_names'] as List?)?.cast<String>() ?? session.inputNames;
    final names = configured.isNotEmpty ? configured : session.inputNames;
    final map = <String, OrtValue>{};

    for (final name in names) {
      final lower = name.toLowerCase();
      if (lower.contains('length') || lower.endsWith('_len') || lower.contains('signal_length')) {
        // Exported IndicConformer CTC expects mel frame count, not PCM samples.
        map[name] = await OrtValue.fromList(Int64List.fromList([mel.frames]), [1]);
        continue;
      }
      // NeMo names this "audio_signal" but the ONNX graph is [B, n_mels, T] mel features.
      map[name] = await OrtValue.fromList(mel.values, [1, mel.nMels, mel.frames]);
    }

    if (map.isEmpty) {
      throw StateError('ONNX graph has no input names');
    }
    return map;
  }

  List<int> _greedyCtcFromLogits(List<dynamic> flat, List<int> shape) {
    // Expect [B, T, V] or [T, V]
    if (shape.length < 2) {
      return flat.map((e) => (e as num).toInt()).toList();
    }
    final classes = shape.last;
    final time = shape.length >= 3 ? shape[shape.length - 2] : shape.first;

    final offset = _vocabOffset;
    final size = _vocabSize;
    final restricted = offset != null &&
        size != null &&
        offset >= 0 &&
        size > 0 &&
        offset + size <= classes;

    final ids = <int>[];
    for (var t = 0; t < time; t++) {
      var bestId = _blankId;
      var best = double.negativeInfinity;

      double? scoreAt(int v) {
        final idx = t * classes + v;
        if (idx >= flat.length) return null;
        return (flat[idx] as num).toDouble();
      }

      if (restricted) {
        for (var v = offset; v < offset + size; v++) {
          final score = scoreAt(v);
          if (score == null) break;
          if (score > best) {
            best = score;
            bestId = v;
          }
        }
        final blankScore = _blankId < classes ? scoreAt(_blankId) : null;
        if (blankScore != null && blankScore > best) {
          bestId = _blankId;
        }
      } else {
        for (var v = 0; v < classes; v++) {
          final score = scoreAt(v);
          if (score == null) break;
          if (score > best) {
            best = score;
            bestId = v;
          }
        }
      }
      ids.add(bestId);
    }
    return ids;
  }

  Future<List<int>> _readWavPcm16Mono16k(String path) async {
    final bytes = await File(path).readAsBytes();
    return decodeWavToPcm16Mono16k(Uint8List.fromList(bytes));
  }

  String decodeCtc(List<int> tokenIds) {
    final out = StringBuffer();
    int? prev;
    for (final id in tokenIds) {
      if (id == prev) continue;
      prev = id;
      if (id == _blankId) continue;
      if (id < 0 || id >= _vocab.length) continue;
      final piece = _vocab[id];
      if (piece == '<blk>' ||
          piece == '<blank>' ||
          piece == 'blank' ||
          piece == '<pad>' ||
          piece == '<unk>') {
        continue;
      }
      out.write(piece.replaceAll('▁', ' ').replaceAll('##', ''));
    }
    return normalizeKashmiriText(out.toString());
  }

  Future<void> dispose() async {
    await _session?.close();
    _session = null;
    _model = null;
  }
}

class _MelArgs {
  const _MelArgs(this.pcm, this.config);
  final List<int> pcm;
  final MelFeatureConfig config;
}

MelFeatures _melIsolate(_MelArgs args) => computeLogMel(args.pcm, config: args.config);
