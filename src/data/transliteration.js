/**
 * Phonetic (Smart Kashmiri) input rules and help examples.
 * This is an input method, not a linguistic romanization standard.
 *
 * Important Unicode choices:
 *   a + ~  -> اٟ initially, ٟ medially
 *   a/i/u  -> اَ/اِ/اُ initially, bare vowel marks medially
 *   e      -> ے
 *   o      -> ۆ
 */

/**
 * A rule target may vary by word position. Kashmiri standalone vowels need an
 * alef carrier initially, while the same short vowel is a combining mark after
 * a consonant.
 */
const positional = (initial, medial) => ({ initial, medial });

/** Longest-first Latin → Kashmiri rules. */
export const PHONETIC_RULES = [
  // Digraphs / trigraphs
  ["chh", "چھ"], ["tsh", "ژ"], ["ts", "ژ"],
  ["kh", "خ"], ["gh", "غ"], ["ch", "چ"], ["sh", "ش"],
  ["bh", "بھ"], ["ph", "پھ"], ["th", "تھ"], ["dh", "دھ"],
  ["rh", "ڑھ"], ["jh", "جھ"], ["ng", "نٛگ"], ["ny", "ں"],

  // Aspirated / retroflex
  ["t'", "ٹ"], ["d'", "ڈ"], ["r'", "ڑ"], ["z'", "ژ"], ["s'", "ش"],
  ["h'", "ح"], ["j'", "ژ"],

  // Explicit vowel sequences
  ["a~", positional("اٟ", "ٟ")],
  ["aa", "آ"], ["ee", "ی"], ["ii", "ی"], ["oo", "و"], ["uu", "و"],
  ["ae", "ٲ"], ["ai", "ے"], ["au", "او"], ["ou", "ۆ"],

  // Single characters
  ["q", "ق"], ["w", "و"], ["e", "ے"], ["r", "ر"], ["t", "ت"], ["y", "ی"],
  ["u", positional("اُ", "ُ")], ["i", positional("اِ", "ِ")], ["o", "ۆ"], ["p", "پ"],
  ["a", positional("اَ", "َ")], ["s", "س"], ["d", "د"], ["f", "ف"], ["g", "گ"], ["h", "ہ"],
  ["j", "ج"], ["k", "ک"], ["l", "ل"],
  ["z", "ز"], ["x", "خ"], ["c", "چ"], ["v", "و"], ["b", "ب"], ["n", "ن"], ["m", "م"],
];

/** Combining vowel marks triggered by special keys in phonetic mode. */
export const COMBINING_MARKS = {
  "~": "ٟ", // U+065F ARABIC WAVY HAMZA BELOW
  "^": "ٖ", // U+0656 ARABIC SUBSCRIPT ALEF
  ":": "ٗ", // U+0657 ARABIC INVERTED DAMMA
};

/** Max buffered Latin sequence length before a forced resolve. */
export const MAX_BUFFER_LENGTH = 6;

/** Help examples shown in the UI. */
export const SMART_EXAMPLES = [
  { latin: "kaeshurii", unicode: "کٲشُری" },
  { latin: "kashur", unicode: "کَشُر" },
  { latin: "sh", unicode: "ش" },
  { latin: "chh", unicode: "چھ" },
  { latin: "t'", unicode: "ٹ" },
];

export const VOWEL_HELPERS = [
  { latin: "a~", unicode: "اٟ", note: "U+0627 + U+065F" },
  { latin: "aa", unicode: "آ" },
  { latin: "e", unicode: "ے" },
  { latin: "i", unicode: "ِ" },
  { latin: "u", unicode: "ُ" },
  { latin: "o", unicode: "ۆ" },
];
