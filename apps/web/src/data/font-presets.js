/**
 * Document-level typography for the WYSIWYG editor.
 *
 * Font and size are applied as CSS variables on the editor card — never as
 * inline Markdown — so exported .md files stay portable.
 *
 * Gulmarg Nastaliq is a Kashmiri-specific Nastaliq face that Google Fonts does
 * not host, so it is self-hosted from public/fonts and declared in style.css.
 * Faiz Lahori Nastaleeq is proprietary and must not be redistributed here. Its
 * preset uses a locally installed, licensed copy and falls back to the bundled
 * and Google-hosted Nastaliq faces.
 */

export const FONT_PRESETS = [
  {
    id: "noto-nastaliq",
    label: "Noto Nastaliq Urdu",
    cssFamily: '"Noto Nastaliq Urdu", "Gulmarg Nastaliq", serif',
    googleFamily: "Noto+Nastaliq+Urdu:wght@400;500;600;700",
    // Nastaliq needs generous leading; sizes are scaled per family.
    lineHeight: 2.05,
  },
  {
    id: "gulmarg-nastaliq",
    label: "Gulmarg Nastaliq",
    cssFamily: '"Gulmarg Nastaliq", "Noto Nastaliq Urdu", serif',
    selfHosted: true,
    lineHeight: 1.95,
  },
  {
    id: "faiz-lahori",
    label: "Faiz Lahori Nastaleeq",
    cssFamily:
      '"Faiz Lahori Nastaleeq Local", "Gulmarg Nastaliq", "Noto Nastaliq Urdu", serif',
    localOnly: true,
    lineHeight: 2,
  },
  {
    id: "scheherazade",
    label: "Scheherazade New",
    cssFamily: '"Scheherazade New", "Noto Naskh Arabic", serif',
    googleFamily: "Scheherazade+New:wght@400;500;600;700",
    lineHeight: 1.8,
  },
];

export const DEFAULT_FONT_PRESET_ID = FONT_PRESETS[0].id;

export function getFontPreset(id) {
  return FONT_PRESETS.find((preset) => preset.id === id) ?? FONT_PRESETS[0];
}

/** Editor body sizes in px. */
export const FONT_SIZES = [18, 20, 22, 24, 28, 32, 36, 42, 48];

export const DEFAULT_FONT_SIZE = 28;

export function normalizeFontSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return FONT_SIZES.reduce(
    (closest, option) =>
      Math.abs(option - value) < Math.abs(closest - value) ? option : closest,
    FONT_SIZES[0]
  );
}

/** Build a Google Fonts CSS2 URL for the presets Google actually hosts. */
export function googleFontsUrl(presets = FONT_PRESETS) {
  const families = presets
    .filter((preset) => preset.googleFamily)
    .map((preset) => `family=${preset.googleFamily}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
