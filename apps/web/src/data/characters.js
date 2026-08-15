/**
 * Extended Kashmiri Arabic-script character inventory.
 *
 * The list follows Richard Ishida's Kashmiri orthography workbench. Values are
 * the exact Unicode text inserted into the editor. Combining marks are shown
 * on their own, without a carrier letter.
 */

const item = (value, name, preview = value) => ({ value, name, preview });
const mark = (value, name) => ({ ...item(value, name), isMark: true });

export const CHARACTER_GROUPS = [
  {
    id: "basic-consonants",
    label: "Basic consonants",
    items: [
      item("پ", "peh"),
      item("ب", "beh"),
      item("ت", "teh"),
      item("د", "dal"),
      item("ٹ", "tteh"),
      item("ڈ", "ddal"),
      item("ژ", "zheh / ts"),
      item("چ", "tcheh"),
      item("ج", "jeem"),
      item("ک", "keheh"),
      item("گ", "gaf"),
      item("س", "seen"),
      item("ز", "zain"),
      item("ش", "sheen"),
      item("ہ", "heh goal"),
      item("ھ", "do chashmi heh"),
      item("م", "meem"),
      item("ن", "noon"),
      item("ں", "noon ghunna"),
      item("و", "waw"),
      item("ر", "reh"),
      item("ل", "lam"),
      item("ی", "Farsi yeh"),
      item("ؠ", "Kashmiri yeh / palatalisation"),
    ],
  },
  {
    id: "aspirated-consonants",
    label: "Aspirated consonants",
    items: [
      item("پھ", "aspirated peh"),
      item("تھ", "aspirated teh"),
      item("ٹھ", "aspirated tteh"),
      item("ژھ", "aspirated zheh"),
      item("چھ", "aspirated tcheh"),
      item("کھ", "aspirated keheh"),
    ],
  },
  {
    id: "extended-consonants",
    label: "Loan-word consonants",
    items: [
      item("ط", "tah"),
      item("ق", "qaf"),
      item("خ", "khah"),
      item("غ", "ghain"),
      item("ع", "ain"),
      item("ف", "feh"),
      item("ث", "theh"),
      item("ذ", "thal"),
      item("ص", "sad"),
      item("ض", "dad"),
      item("ظ", "zah"),
      item("ح", "hah"),
      item("ڑ", "rreh"),
    ],
  },
  {
    id: "vowel-letters",
    label: "Vowel letters & sequences",
    items: [
      item("ا", "alef / long a"),
      item("آ", "alef madda / initial long a"),
      item("أ", "initial schwa"),
      item("إ", "initial short central i"),
      item("ٲ", "long schwa"),
      item("ۄ", "open o"),
      item("ۄا", "long open o"),
      item("ؤ", "waw with hamza"),
      item("ۂ", "heh goal with hamza"),
      item("ی", "long i/e (medial)"),
      item("ے", "long e (final)"),
      item("یٖ", "long i (medial)"),
      item("یٚ", "short e (medial)"),
      item("ےٚ", "short e (final)"),
      item("وٗ", "long u"),
      item("وٚ", "short o"),
      item("اٟ", "initial long central i"),
    ],
  },
  {
    id: "vowel-marks",
    label: "Vowel marks",
    items: [
      mark("َ", "fatha / short a"),
      mark("ِ", "kasra / short i"),
      mark("ُ", "damma / short u"),
      mark("ٔ", "hamza above / schwa"),
      mark("ٕ", "hamza below / central i"),
      mark("ٖ", "subscript alef / long i"),
      mark("ٟ", "wavy hamza below / long central i"),
      mark("ٚ", "inverted v above / short e or o"),
      mark("ٗ", "inverted damma / long u"),
      mark("ٓ", "madda above"),
    ],
  },
  {
    id: "other-marks",
    label: "Other marks",
    items: [
      mark("ْ", "sukun / Kashmiri jazm"),
      mark("ّ", "shadda"),
      mark("ؔ", "takhallus sign"),
    ],
  },
  {
    id: "punctuation",
    label: "Punctuation",
    items: [
      item("۔", "full stop"),
      item("،", "comma"),
      item("؛", "semicolon"),
      item(":", "colon"),
      item("؟", "question mark"),
      item("!", "exclamation mark"),
      item("؍", "date separator"),
      item("٪", "percent"),
      item("“", "opening quotation mark"),
      item("”", "closing quotation mark"),
      item("(", "opening parenthesis"),
      item(")", "closing parenthesis"),
      item("‐", "hyphen"),
      item("ـ", "tatweel"),
    ],
  },
  {
    id: "digits",
    label: "Digits",
    items: [..."۰۱۲۳۴۵۶۷۸۹"].map((value, index) =>
      item(value, `digit ${index}`)
    ),
  },
];

