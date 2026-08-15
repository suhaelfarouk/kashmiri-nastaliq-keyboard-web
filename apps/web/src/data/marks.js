/**
 * Combining-mark helpers shared by the keyboard and the character palette.
 *
 * Marks are displayed bare, with no carrier letter. A lone mark is drawn
 * relative to an invisible baseline, so the UI needs to know whether it hangs
 * above or below that baseline in order to keep it inside its button.
 */

const COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]$/;

const BELOW = new Set([
  "\u064D", // kasratan
  "\u0650", // kasra
  "\u0655", // hamza below
  "\u0656", // subscript alef
  "\u065F", // wavy hamza below
  "\u06E3", // small low seen
  "\u06EA", // empty centre low stop
  "\u06ED", // small low meem
]);

export function isCombiningMark(text) {
  return COMBINING.test(text);
}

/**
 * CSS-friendly name describing how a bare mark should be positioned.
 * @returns {"mark"|"mark-below"|null} null when the text is not a lone mark.
 */
export function markPlacement(text) {
  if (!isCombiningMark(text)) return null;
  return BELOW.has(text) ? "mark-below" : "mark";
}
