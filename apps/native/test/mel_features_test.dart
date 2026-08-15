import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/features/transcription/data/mel_features.dart';

void main() {
  test('computeLogMel produces n_mels x frames', () {
    final pcm = List<int>.generate(8000, (i) => ((i % 36) < 18) ? 8000 : -8000);
    final mel = computeLogMel(pcm);
    expect(mel.nMels, 80);
    expect(mel.frames, greaterThan(10));
    expect(mel.values.length, mel.nMels * mel.frames);
  });

  test('MelFeatureConfig reads export metadata', () {
    final cfg = MelFeatureConfig.fromJson({
      'sample_rate': 16000,
      'feature': {'n_mels': 64, 'hop_length': 160, 'n_fft': 512},
    });
    expect(cfg.nMels, 64);
    expect(cfg.hopLength, 160);
  });

  test('matches NeMo AudioToMelSpectrogramPreprocessor golden fixture', () {
    final golden = jsonDecode(
      File('test/fixtures/mel_golden.json').readAsStringSync(),
    ) as Map<String, dynamic>;

    final pcm = (golden['pcm16'] as List).cast<int>();
    final expectedFrames = golden['frames'] as int;
    final expectedMels = golden['n_mels'] as int;
    final expected = (golden['mel'] as List)
        .map((v) => (v as num).toDouble())
        .toList();

    final mel = computeLogMel(pcm);
    expect(mel.nMels, expectedMels);
    expect(mel.frames, expectedFrames);
    expect(mel.values.length, expected.length);

    var maxDiff = 0.0;
    for (var i = 0; i < expected.length; i++) {
      maxDiff = math.max(maxDiff, (mel.values[i] - expected[i]).abs());
    }
    // Tight tolerance: preprocessing must stay bit-close to NeMo or the
    // published CTC model decodes to blanks.
    expect(maxDiff, lessThan(1e-3), reason: 'max abs diff was $maxDiff');
  });

  test('per-feature normalization centers each mel bin', () {
    final pcm = List<int>.generate(
      6400,
      (i) => (6000 * math.sin(2 * math.pi * 300 * i / 16000)).round(),
    );
    final mel = computeLogMel(pcm);

    for (var m = 0; m < mel.nMels; m++) {
      var sum = 0.0;
      for (var f = 0; f < mel.frames; f++) {
        sum += mel.values[m * mel.frames + f];
      }
      expect((sum / mel.frames).abs(), lessThan(1e-3));
    }
  });
}
