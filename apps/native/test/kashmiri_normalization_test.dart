import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/core/text/kashmiri_orthography.dart';
import 'package:makhzan/features/transcription/data/ctc_inference_service.dart';

/// Codepoints the bundled Noto Nastaliq Urdu face maps, read from its `cmap`.
///
/// Parsed rather than hard-coded so swapping the font file cannot silently
/// invalidate the expectations below.
Set<int> _fontCoverage(String path) {
  final data = ByteData.sublistView(File(path).readAsBytesSync());
  final tableCount = data.getUint16(4);
  int? cmapStart;
  for (var i = 0; i < tableCount; i++) {
    final off = 12 + 16 * i;
    final tag = String.fromCharCodes(
        Uint8List.sublistView(data, off, off + 4));
    if (tag == 'cmap') cmapStart = data.getUint32(off + 8);
  }
  expect(cmapStart, isNotNull, reason: 'font has no cmap table');

  final covered = <int>{};
  final subtables = data.getUint16(cmapStart! + 2);
  for (var i = 0; i < subtables; i++) {
    final entry = cmapStart + 4 + 8 * i;
    final base = cmapStart + data.getUint32(entry + 4);
    final format = data.getUint16(base);
    if (format == 4) {
      final segBytes = data.getUint16(base + 6);
      final segments = segBytes ~/ 2;
      for (var s = 0; s < segments; s++) {
        final end = data.getUint16(base + 14 + s * 2);
        final start = data.getUint16(base + 16 + segBytes + s * 2);
        if (start == 0xFFFF) continue;
        for (var cp = start; cp <= end; cp++) {
          covered.add(cp);
        }
      }
    } else if (format == 12) {
      final groups = data.getUint32(base + 12);
      for (var g = 0; g < groups; g++) {
        final off = base + 16 + 12 * g;
        final start = data.getUint32(off);
        final end = data.getUint32(off + 4);
        for (var cp = start; cp <= end && cp < start + 0x10000; cp++) {
          covered.add(cp);
        }
      }
    }
  }
  return covered;
}

void main() {
  const fontPath = 'assets/fonts/NotoNastaliqUrdu-VariableFont_wght.ttf';

  test('folded letters are absent from the bundled face', () {
    final covered = _fontCoverage(fontPath);
    // The whole point of a fold is that the source glyph is unavailable; if the
    // font gains coverage the fold can be dropped.
    for (final source in kashmiriCharacterFolds.keys) {
      expect(
        covered.contains(source.codeUnitAt(0)),
        isFalse,
        reason: 'U+${source.codeUnitAt(0).toRadixString(16).toUpperCase()} '
            'is now covered; the fold is no longer needed',
      );
    }
  });

  test('fold targets are covered by the bundled face', () {
    final covered = _fontCoverage(fontPath);
    for (final target in kashmiriCharacterFolds.values) {
      expect(
        covered.contains(target.codeUnitAt(0)),
        isTrue,
        reason: 'fold target U+'
            '${target.codeUnitAt(0).toRadixString(16).toUpperCase()} '
            'is missing from the font',
      );
    }
  });

  test('normalization leaves no character that would break Nastaliq joining',
      () {
    final covered = _fontCoverage(fontPath);
    // Swash kaf is dual-joining, so an unfolded one visibly splits a word.
    const raw = 'ڪتاب ٴاکھ کؙن';
    final normalized = normalizeKashmiriText(raw);

    expect(normalized, 'کتاب ءاکھ کُن');
    for (final rune in normalized.runes) {
      if (rune == 0x20) continue;
      expect(covered.contains(rune), isTrue,
          reason: 'U+${rune.toRadixString(16).toUpperCase()} is not in the '
              'bundled face and would trigger a fallback font');
    }
  });

  test('normalization collapses whitespace and duplicate ZWNJ', () {
    expect(normalizeKashmiriText('  اکھ   زبان  '), 'اکھ زبان');
    expect(normalizeKashmiriText('اکھ\u200c\u200cزبان'), 'اکھ\u200cزبان');
  });

  test('normalization preserves Kashmiri-specific letters and marks', () {
    // Regression guard: folding must not touch the codepoints the on-screen
    // keyboard produces.
    const sample = '\u0620\u0672\u06C4\u06CD\u0654\u0656\u065A\u065F';
    expect(normalizeKashmiriText(sample), sample);
  });

  group('input folding', () {
    const formatter = KashmiriCharacterFoldingFormatter();

    test('every fold is one code unit to one code unit', () {
      // The formatter reuses the incoming selection, which is only sound while
      // folding cannot change the text length.
      kashmiriCharacterFolds.forEach((source, target) {
        expect(source.length, 1, reason: 'fold source must be one code unit');
        expect(target.length, 1, reason: 'fold target must be one code unit');
      });
    });

    test('folds pasted text and keeps the caret in place', () {
      const pasted = 'ڪتاب';
      final result = formatter.formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(
          text: pasted,
          selection: TextSelection.collapsed(offset: 4),
        ),
      );

      expect(result.text, 'کتاب');
      expect(result.selection.baseOffset, 4);
    });

    test('preserves a selection and composing range', () {
      final result = formatter.formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(
          text: 'اکھ ڪتاب',
          selection: TextSelection(baseOffset: 4, extentOffset: 8),
          composing: TextRange(start: 4, end: 8),
        ),
      );

      expect(result.text, 'اکھ کتاب');
      expect(result.selection, const TextSelection(baseOffset: 4, extentOffset: 8));
      expect(result.composing, const TextRange(start: 4, end: 8));
    });

    test('leaves clean Kashmiri input untouched', () {
      const clean = TextEditingValue(
        text: 'یِتھ کٲشُری',
        selection: TextSelection.collapsed(offset: 11),
      );
      expect(formatter.formatEditUpdate(TextEditingValue.empty, clean), clean);
    });

    test('does not collapse spaces the user is typing', () {
      // Decode-time normalization trims and collapses whitespace; input folding
      // must not, or the space key would appear broken.
      const typing = TextEditingValue(
        text: 'اکھ  ',
        selection: TextSelection.collapsed(offset: 5),
      );
      final result =
          formatter.formatEditUpdate(TextEditingValue.empty, typing);
      expect(result.text, 'اکھ  ');
    });
  });
}
