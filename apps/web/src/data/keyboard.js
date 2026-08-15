/**
 * Canonical QWERTY → Makhzan layout.
 * One source of truth for rendering, on-screen clicks, and physical key mapping.
 *
 * Four layers per key, following the convention used by desktop Kashmiri layouts:
 *   base      — everyday letters
 *   shift     — alternate letters and the most common marks
 *   alt       — aspirated digraphs, vowel sequences, remaining combining marks
 *   altShift  — loan-word consonants, precomposed vowels, punctuation, controls
 *
 * A layer may be left undefined; that key simply inserts nothing on that layer.
 */

import { markPlacement } from "./marks.js";

export const KEY_CODES = {
  SPACE: "Space",
  SHIFT: "ShiftLeft",
  ALT: "AltLeft",
  BACKSPACE: "Backspace",
};

/** Layer identifiers used by the UI and by resolveKeyChar. */
export const LAYERS = {
  BASE: "base",
  SHIFT: "shift",
  ALT: "alt",
  ALT_SHIFT: "altShift",
};

/** Human-readable layer names for the status badge and layer selector. */
export const LAYER_LABELS = {
  [LAYERS.BASE]: "Base",
  [LAYERS.SHIFT]: "Shift",
  [LAYERS.ALT]: "Alt",
  [LAYERS.ALT_SHIFT]: "Alt + Shift",
};

/**
 * @typedef {object} KeyDef
 * @property {string} code
 * @property {string} label
 * @property {string} base
 * @property {string} [shift]
 * @property {string} [alt]
 * @property {string} [altShift]
 * @property {"char"|"space"|"shift"|"alt"|"backspace"} [type]
 */

const ZWNJ = "\u200C";
const ZWJ = "\u200D";

/** @type {KeyDef[][]} */
export const KEYBOARD_ROWS = [
  [
    { code: "Digit1", label: "1", base: "۱", alt: "َ", altShift: "ؔ" },
    { code: "Digit2", label: "2", base: "۲", alt: "ِ", altShift: "٬" },
    { code: "Digit3", label: "3", base: "۳", alt: "ُ", altShift: "؍" },
    { code: "Digit4", label: "4", base: "۴", alt: "ٔ", altShift: "٪" },
    { code: "Digit5", label: "5", base: "۵", shift: "٪", alt: "ٕ", altShift: "“" },
    { code: "Digit6", label: "6", base: "۶", alt: "ٖ", altShift: "”" },
    { code: "Digit7", label: "7", base: "۷", alt: "ٟ", altShift: "(" },
    { code: "Digit8", label: "8", base: "۸", alt: "ٚ", altShift: ")" },
    { code: "Digit9", label: "9", base: "۹", alt: "ٗ", altShift: "‐" },
    { code: "Digit0", label: "0", base: "۰", alt: "ْ", altShift: "ـ" },
    { code: "Minus", label: "-", base: "۔", shift: "-", alt: "ّ", altShift: ZWNJ },
    { code: "Equal", label: "=", base: "،", shift: "=", alt: "ٓ", altShift: ZWJ },
  ],
  [
    { code: "KeyQ", label: "q", base: "ق", shift: "ٖ" },
    { code: "KeyW", label: "w", base: "و", shift: "ؤ", alt: "وٗ", altShift: "وٚ" },
    { code: "KeyE", label: "e", base: "ے", shift: "ٲ", alt: "ےٚ", altShift: "یٚ" },
    { code: "KeyR", label: "r", base: "ر", shift: "ڑ", alt: "ڑھ" },
    { code: "KeyT", label: "t", base: "ت", shift: "ٹ", alt: "تھ", altShift: "ٹھ" },
    { code: "KeyY", label: "y", base: "ی", shift: "ؠ", alt: "یٖ", altShift: "یٚ" },
    { code: "KeyU", label: "u", base: "ُ", shift: "ٗ", alt: "وٗ" },
    { code: "KeyI", label: "i", base: "ِ", shift: "ٕ", alt: "ٖ", altShift: "ٟ" },
    { code: "KeyO", label: "o", base: "ۆ", shift: "ۄ", alt: "وٚ", altShift: "ۄا" },
    { code: "KeyP", label: "p", base: "پ", shift: "ث", alt: "پھ", altShift: "ف" },
    { code: "BracketLeft", label: "[", base: "[", shift: "]", alt: "“", altShift: "(" },
    { code: "BracketRight", label: "]", base: "]", shift: "}", alt: "”", altShift: ")" },
  ],
  [
    { code: "KeyA", label: "a", base: "ا", shift: "آ", alt: "اٟ", altShift: "أ" },
    { code: "KeyS", label: "s", base: "س", shift: "ش", alt: "ص", altShift: "ث" },
    { code: "KeyD", label: "d", base: "د", shift: "ڈ", alt: "دھ", altShift: "ذ" },
    { code: "KeyF", label: "f", base: "ف", shift: "ڤ", alt: "ظ", altShift: "ط" },
    { code: "KeyG", label: "g", base: "گ", shift: "غ", alt: "گھ", altShift: "ع" },
    { code: "KeyH", label: "h", base: "ہ", shift: "ح", alt: "ھ", altShift: "ۂ" },
    { code: "KeyJ", label: "j", base: "ج", shift: "ژ", alt: "جھ", altShift: "ژھ" },
    { code: "KeyK", label: "k", base: "ک", shift: "خ", alt: "کھ", altShift: "ق" },
    { code: "KeyL", label: "l", base: "ل", shift: "ڵ", alt: "لا" },
    { code: "Semicolon", label: ";", base: "؛", shift: ":", alt: "؍", altShift: "…" },
    { code: "Quote", label: "'", base: "ء", shift: "ٔ", alt: "إ", altShift: "ٓ" },
  ],
  [
    { code: "KeyZ", label: "z", base: "ز", shift: "ژ", alt: "ژھ", altShift: "ض" },
    { code: "KeyX", label: "x", base: "خ", shift: "ح", alt: "ظ", altShift: "ذ" },
    { code: "KeyC", label: "c", base: "چ", shift: "چھ", alt: "ژ", altShift: "ژھ" },
    { code: "KeyV", label: "v", base: "و", shift: "ۆ", alt: "ۄ", altShift: "ۄا" },
    { code: "KeyB", label: "b", base: "ب", shift: "بھ", alt: "ؤ", altShift: "ۂ" },
    { code: "KeyN", label: "n", base: "ن", shift: "ں", alt: "نْ", altShift: "ؠ" },
    { code: "KeyM", label: "m", base: "م", shift: "ں", alt: "ّ", altShift: "ؔ" },
    { code: "Comma", label: ",", base: "،", shift: "٬", alt: "؍", altShift: "“" },
    { code: "Period", label: ".", base: "۔", shift: "?", alt: "٪", altShift: "”" },
    { code: "Slash", label: "/", base: "؟", shift: "/", alt: "!", altShift: "‐" },
  ],
  [
    { code: KEY_CODES.SPACE, label: "space", base: " ", type: "space" },
    { code: KEY_CODES.SHIFT, label: "shift", base: "", type: "shift" },
    { code: KEY_CODES.ALT, label: "alt", base: "", type: "alt" },
    { code: KEY_CODES.BACKSPACE, label: "backspace", base: "", type: "backspace" },
  ],
];

/** Flat lookup: code → KeyDef */
export const KEY_BY_CODE = Object.fromEntries(
  KEYBOARD_ROWS.flat().map((key) => [key.code, key])
);

/** True for keys that produce text rather than acting as a modifier. */
export function isCharacterKey(key) {
  return key != null && (key.type === undefined || key.type === "char");
}

/**
 * Character faces for a key, in layer order.
 * Missing layers are empty strings so the UI can render a blank face.
 */
export function keyFaces(key) {
  return {
    [LAYERS.BASE]: key.base ?? "",
    [LAYERS.SHIFT]: key.shift ?? key.base ?? "",
    [LAYERS.ALT]: key.alt ?? "",
    [LAYERS.ALT_SHIFT]: key.altShift ?? "",
  };
}

const CONTROL_LABELS = { [ZWNJ]: "ZWNJ", [ZWJ]: "ZWJ" };

/**
 * How a face should be drawn on a keycap. Combining marks are shown on their
 * own — no carrier letter — and invisible controls get a Latin caption.
 * @returns {{ text: string, kind: "text"|"mark"|"mark-below"|"control" }}
 */
export function faceDisplay(face) {
  if (CONTROL_LABELS[face]) return { text: CONTROL_LABELS[face], kind: "control" };
  const placement = markPlacement(face);
  if (placement) return { text: face, kind: placement };
  // A lone tatweel is nearly invisible; repeat it into a legible connector.
  if (face === "ـ") return { text: "ـــ", kind: "text" };
  return { text: face, kind: "text" };
}

/** Combine modifier state into a layer identifier. */
export function layerFor({ shift = false, alt = false } = {}) {
  if (alt && shift) return LAYERS.ALT_SHIFT;
  if (alt) return LAYERS.ALT;
  if (shift) return LAYERS.SHIFT;
  return LAYERS.BASE;
}

/**
 * Resolve the character a key produces on a given layer.
 * @param {string} code
 * @param {string} layer One of LAYERS.
 * @returns {string} Empty string when the key is a modifier or the layer is unassigned.
 */
export function resolveKeyChar(code, layer = LAYERS.BASE) {
  const key = KEY_BY_CODE[code];
  if (!key) return "";
  if (key.type === "space") return " ";
  if (!isCharacterKey(key)) return "";
  return keyFaces(key)[layer] ?? "";
}
