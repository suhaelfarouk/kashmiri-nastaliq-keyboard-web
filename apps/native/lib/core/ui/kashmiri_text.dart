import 'package:flutter/widgets.dart';

/// Presentation rules for Kashmiri Perso-Arabic text.
///
/// Shares the web editor's default face (Noto Nastaliq Urdu) and leading so a
/// transcript is readable before the clipboard handoff. Size stays at 28 px on
/// device — larger than the web default of 16 px — because Nastaliq stacks
/// glyphs steeply and a phone-width field clips them at body size.
class KashmiriText {
  const KashmiriText._();

  static const fontFamily = 'Noto Nastaliq Urdu';
  static const locale = Locale('ks');
  static const fontSize = 28.0;
  static const lineHeight = 2.05;

  static const TextStyle style = TextStyle(
    fontFamily: fontFamily,
    fontSize: fontSize,
    height: lineHeight,
    locale: locale,
    // The bundled face is a variable font; pin the weight axis so it renders at
    // the web editor's regular weight instead of an arbitrary default instance.
    fontWeight: FontWeight.w400,
    fontVariations: [FontVariation('wght', 400)],
    // Split the generous Nastaliq leading above and below each line so tall
    // ascenders and deep descenders are not clipped in a text field.
    leadingDistribution: TextLeadingDistribution.even,
  );

  /// Keeps the caret, selection, and placeholder on the right for RTL input.
  static Widget rtl({required Widget child}) => Directionality(
        textDirection: TextDirection.rtl,
        child: child,
      );
}
