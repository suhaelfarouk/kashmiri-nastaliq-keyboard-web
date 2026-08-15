import 'package:flutter/services.dart';

/// Perso-Arabic letters that must not reach the transcript, mapped to the
/// equivalent the on-screen keyboard produces.
///
/// Two sources push these into the app. The speech model's tokenizer is shared
/// by 22 languages, so greedy decoding can emit letters belonging to Sindhi or
/// Shahmukhi Punjabi; a user can also type or paste them from a system keyboard.
///
/// Besides being wrong for Kashmiri, none of them exist in the bundled Noto
/// Nastaliq Urdu face. A codepoint the face does not cover falls back to a
/// system font mid-word, which splits the text shaping run so the letters around
/// it stop joining. Swash kaf is dual-joining, so a single one tears a whole word
/// apart. The web editor hides the same problem because its CSS falls back to
/// Gulmarg Nastaliq, which is not bundled here.
///
/// Every entry must be a single UTF-16 code unit mapping to a single code unit so
/// folding cannot shift caret offsets. `kashmiri_normalization_test.dart` pins
/// that, and `tools/model/scripts/check_font_coverage.py` parses this map to
/// check the vocabulary against the bundled face.
const kashmiriCharacterFolds = <String, String>{
  // U+06AA swash kaf -> U+06A9 keheh
  '\u06AA': '\u06A9',
  // U+0674 high hamza -> U+0621 hamza
  '\u0674': '\u0621',
  // U+0619 small damma -> U+064F damma
  '\u0619': '\u064F',
};

/// Replace model-only and foreign-keyboard letters with Kashmiri equivalents.
///
/// Length-preserving, so caret and selection offsets stay valid.
String foldKashmiriCharacters(String text) {
  var out = text;
  for (final entry in kashmiriCharacterFolds.entries) {
    out = out.replaceAll(entry.key, entry.value);
  }
  return out;
}

/// Applies [foldKashmiriCharacters] to typed and pasted text.
///
/// Without this, a character pasted from another Perso-Arabic keyboard would
/// break joining in the review field even though decoded transcripts are clean.
class KashmiriCharacterFoldingFormatter extends TextInputFormatter {
  const KashmiriCharacterFoldingFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final folded = foldKashmiriCharacters(newValue.text);
    if (folded == newValue.text) return newValue;
    // Folds are 1:1 on code units, so the incoming selection and composing
    // ranges still describe the same positions.
    assert(folded.length == newValue.text.length);
    if (folded.length != newValue.text.length) return newValue;
    return TextEditingValue(
      text: folded,
      selection: newValue.selection,
      composing: newValue.composing,
    );
  }
}
