import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faceDisplay,
  isCharacterKey,
  KEY_BY_CODE,
  KEY_CODES,
  KEYBOARD_ROWS,
  keyFaces,
  LAYERS,
  layerFor,
  resolveKeyChar,
} from "../src/data/keyboard.js";

const characterKeys = KEYBOARD_ROWS.flat().filter(isCharacterKey);

describe("keyboard layout", () => {
  it("has unique key codes", () => {
    const codes = KEYBOARD_ROWS.flat().map((key) => key.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("derives layers from modifier state", () => {
    assert.equal(layerFor(), LAYERS.BASE);
    assert.equal(layerFor({ shift: true }), LAYERS.SHIFT);
    assert.equal(layerFor({ alt: true }), LAYERS.ALT);
    assert.equal(layerFor({ shift: true, alt: true }), LAYERS.ALT_SHIFT);
  });

  it("resolves each layer of a fully mapped key", () => {
    assert.equal(resolveKeyChar("KeyT", LAYERS.BASE), "ت");
    assert.equal(resolveKeyChar("KeyT", LAYERS.SHIFT), "ٹ");
    assert.equal(resolveKeyChar("KeyT", LAYERS.ALT), "تھ");
    assert.equal(resolveKeyChar("KeyT", LAYERS.ALT_SHIFT), "ٹھ");
  });

  it("falls back to base on the shift layer but not on alt layers", () => {
    const faces = keyFaces(KEY_BY_CODE.KeyQ);
    assert.equal(faces[LAYERS.SHIFT], faces[LAYERS.BASE]);
    assert.equal(faces[LAYERS.ALT], "ٖ");
    assert.equal(resolveKeyChar("KeyQ", LAYERS.ALT_SHIFT), "");
    assert.equal(resolveKeyChar("Digit1", LAYERS.SHIFT), "۱");
  });

  it("returns no character for modifier keys and space for the spacebar", () => {
    assert.equal(resolveKeyChar(KEY_CODES.SHIFT, LAYERS.BASE), "");
    assert.equal(resolveKeyChar(KEY_CODES.ALT, LAYERS.ALT), "");
    assert.equal(resolveKeyChar(KEY_CODES.BACKSPACE, LAYERS.BASE), "");
    assert.equal(resolveKeyChar(KEY_CODES.SPACE, LAYERS.ALT_SHIFT), " ");
    assert.equal(resolveKeyChar("NoSuchKey", LAYERS.BASE), "");
  });

  it("reaches the extended Kashmiri inventory across the alt layers", () => {
    const reachable = new Set(
      characterKeys.flatMap((key) => [key.alt, key.altShift]).filter(Boolean),
    );
    for (const required of ["پھ", "تھ", "ٹھ", "ژھ", "کھ", "ھ", "نْ", "اٟ", "وٗ", "ۄا", "ْ", "ّ", "ؔ"]) {
      assert.ok(reachable.has(required), `missing ${required}`);
    }
  });

  it("draws marks bare and captions invisible controls", () => {
    assert.deepEqual(faceDisplay("ْ"), { text: "ْ", kind: "mark" });
    assert.deepEqual(faceDisplay("َ"), { text: "َ", kind: "mark" });
    assert.deepEqual(faceDisplay("ِ"), { text: "ِ", kind: "mark-below" });
    assert.deepEqual(faceDisplay("ٟ"), { text: "ٟ", kind: "mark-below" });
    assert.deepEqual(faceDisplay("\u200C"), { text: "ZWNJ", kind: "control" });
    assert.deepEqual(faceDisplay("\u200D"), { text: "ZWJ", kind: "control" });
    assert.deepEqual(faceDisplay("ت"), { text: "ت", kind: "text" });
    assert.deepEqual(faceDisplay(""), { text: "", kind: "text" });
  });

  it("keeps every mapped face non-empty when defined", () => {
    for (const key of characterKeys) {
      for (const [layer, face] of Object.entries(keyFaces(key))) {
        assert.equal(typeof face, "string", `${key.code} ${layer}`);
      }
      assert.notEqual(key.base, undefined, `${key.code} needs a base character`);
    }
  });
});
