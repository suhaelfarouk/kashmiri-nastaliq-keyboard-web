import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DEFAULT_FONT_PRESET_ID,
  DEFAULT_FONT_SIZE,
  FONT_PRESETS,
  FONT_SIZES,
  getFontPreset,
  googleFontsUrl,
  normalizeFontSize,
} from "../src/data/font-presets.js";

describe("font presets", () => {
  it("offers the curated hosted and local faces", () => {
    assert.deepEqual(
      FONT_PRESETS.map((preset) => preset.id),
      ["noto-nastaliq", "gulmarg-nastaliq", "faiz-lahori", "scheherazade"],
    );
    assert.equal(DEFAULT_FONT_PRESET_ID, "noto-nastaliq");
  });

  it("falls back to the default preset for unknown ids", () => {
    assert.equal(getFontPreset("missing").id, DEFAULT_FONT_PRESET_ID);
    assert.match(getFontPreset("gulmarg-nastaliq").cssFamily, /Gulmarg Nastaliq/);
    assert.match(getFontPreset("faiz-lahori").cssFamily, /Faiz Lahori/);
    assert.match(getFontPreset("scheherazade").cssFamily, /Scheherazade New/);
  });

  it("gives every preset a family, Word face name, and leading", () => {
    for (const preset of FONT_PRESETS) {
      assert.ok(preset.cssFamily.includes(preset.label.split(" ")[0]), preset.id);
      assert.ok(preset.docxFont, `${preset.id} needs a Word font name`);
      assert.ok(preset.lineHeight > 1.5, `${preset.id} needs generous leading`);
    }
  });

  it("self-hosts Gulmarg and omits it from the Google Fonts URL", () => {
    const gulmarg = getFontPreset("gulmarg-nastaliq");
    assert.equal(gulmarg.selfHosted, true);
    assert.equal(gulmarg.googleFamily, undefined);

    const url = googleFontsUrl();
    assert.match(url, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
    assert.ok(!url.includes("Gulmarg"));
    for (const preset of FONT_PRESETS.filter((p) => p.googleFamily)) {
      assert.ok(url.includes(`family=${preset.googleFamily}`), preset.id);
    }
  });

  it("uses Faiz Lahori only from a licensed local installation", () => {
    const faiz = getFontPreset("faiz-lahori");
    assert.equal(faiz.localOnly, true);
    assert.equal(faiz.selfHosted, undefined);
    assert.equal(faiz.googleFamily, undefined);
    assert.match(faiz.cssFamily, /^"Faiz Lahori Nastaleeq Local"/);
    assert.match(faiz.cssFamily, /"Gulmarg Nastaliq"/);
    assert.ok(!googleFontsUrl().includes("Faiz"));

    const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
    const declaration = css.match(/@font-face\s*\{[^}]*"Faiz Lahori Nastaleeq Local"[^}]*\}/s)?.[0];
    assert.ok(declaration, "local Faiz @font-face must exist");
    assert.match(declaration, /local\("Faiz Lahori Nastaleeq"\)/);
    assert.ok(!declaration.includes("url("), "Faiz must not be redistributed");
  });

  it("snaps font sizes to the nearest supported step", () => {
    assert.equal(DEFAULT_FONT_SIZE, 16);
    assert.ok(FONT_SIZES.includes(DEFAULT_FONT_SIZE));
    assert.ok(FONT_SIZES.includes(12));
    assert.ok(FONT_SIZES.includes(14));
    assert.equal(normalizeFontSize(16), 16);
    assert.equal(normalizeFontSize(28), 28);
    assert.equal(normalizeFontSize("32"), 32);
    assert.equal(normalizeFontSize(29), 28);
    assert.equal(normalizeFontSize(1), 12);
    assert.equal(normalizeFontSize(999), 48);
    assert.equal(normalizeFontSize("abc"), DEFAULT_FONT_SIZE);
    assert.equal(normalizeFontSize(undefined), DEFAULT_FONT_SIZE);
  });
});
