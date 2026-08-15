import 'package:flutter/widgets.dart';

/// Presentation rules for Kashmiri Perso-Arabic text.
///
/// Matches the web editor default face (Noto Nastaliq Urdu) so a transcript
/// looks the same before and after the clipboard handoff. Nastaliq stacks
/// glyphs steeply, so it needs a much larger line height than Latin text or
/// ascenders/descenders collide.
class KashmiriText {
  const KashmiriText._();

  static const fontFamily = 'Noto Nastaliq Urdu';
  static const locale = Locale('ks');
  static const fontSize = 22.0;
  static const lineHeight = 2.1;

  static const TextStyle style = TextStyle(
    fontFamily: fontFamily,
    fontSize: fontSize,
    height: lineHeight,
    locale: locale,
  );

  /// Keeps the caret, selection, and placeholder on the right for RTL input.
  static Widget rtl({required Widget child}) => Directionality(
        textDirection: TextDirection.rtl,
        child: child,
      );
}
