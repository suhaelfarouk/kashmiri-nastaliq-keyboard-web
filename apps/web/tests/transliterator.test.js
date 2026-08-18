import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTransliterator } from "../src/core/transliterator.js";

function type(sequence) {
  const t = createTransliterator();
  let out = "";
  for (const ch of sequence) {
    out += t.add(ch);
  }
  out += t.commit();
  return out;
}

describe("createTransliterator", () => {
  it("maps kaeshuri → کٲشُرِ", () => {
    // Final i is the short-i mark (kasra); use ii/ee for ی.
    assert.equal(type("kaeshuri"), "کٲشُرِ");
    assert.equal(type("kaeshurii"), "کٲشُری");
  });

  it("maps kashur → کَشُر", () => {
    assert.equal(type("kashur"), "کَشُر");
  });

  it("resolves digraphs and trigraphs", () => {
    assert.equal(type("sh"), "ش");
    assert.equal(type("kh"), "خ");
    assert.equal(type("gh"), "غ");
    assert.equal(type("ch"), "چ");
    assert.equal(type("chh"), "چھ");
    assert.equal(type("bh"), "بھ");
    assert.equal(type("ph"), "پھ");
    assert.equal(type("th"), "تھ");
    assert.equal(type("dh"), "دھ");
  });

  it("resolves retroflex forms", () => {
    assert.equal(type("t'"), "ٹ");
    assert.equal(type("d'"), "ڈ");
    assert.equal(type("r'"), "ڑ");
  });

  it("resolves vowel + nasal compounds", () => {
    assert.equal(type("an"), "اَن");
    assert.equal(type("in"), "اِن");
    assert.equal(type("un"), "اُن");
  });

  it("adds an alef carrier to word-initial short vowels", () => {
    assert.equal(type("a"), "اَ");
    assert.equal(type("i"), "اِ");
    assert.equal(type("u"), "اُ");
  });

  it("maps short vowels as diacritics", () => {
    assert.equal(type("ka"), "کَ");
    assert.equal(type("ki"), "کِ");
    assert.equal(type("ku"), "کُ");
  });

  it("restores initial-vowel behavior after a word boundary", () => {
    const t = createTransliterator();
    let out = t.add("k") + t.add("a") + t.commit();
    t.wordBoundary();
    out += ` ${t.add("i")}${t.commit()}`;
    assert.equal(out, "کَ اِ");
    assert.equal(t.isAtWordStart(), false);
  });

  it("maps long vowels", () => {
    assert.equal(type("aa"), "آ");
    assert.equal(type("ae"), "ٲ");
    assert.equal(type("e"), "ے");
    assert.equal(type("o"), "ۆ");
  });

  it("waits on ambiguous prefixes then commits", () => {
    const t = createTransliterator();
    assert.equal(t.add("c"), "");
    assert.equal(t.add("h"), "");
    assert.equal(t.add("h"), "چھ");
  });

  it("force-commits remaining buffer", () => {
    const t = createTransliterator();
    assert.equal(t.add("c"), "");
    assert.equal(t.commit(), "چ");
    assert.equal(t.getBuffer(), "");
  });

  it("preserves unknown Latin characters", () => {
    assert.equal(type("1"), "1");
  });

  it("handles combining marks", () => {
    const t = createTransliterator();
    let out = t.add("a");
    out += t.handleKey("~").text;
    assert.equal(out, "اٟ");
  });

  it("uses the bare long central-vowel mark medially", () => {
    const t = createTransliterator();
    let out = t.add("k");
    out += t.add("a");
    out += t.handleKey("~").text;
    assert.equal(out, "کٟ");
  });

  it("backspaces the Latin buffer", () => {
    const t = createTransliterator();
    t.add("c");
    assert.equal(t.backspace(), true);
    assert.equal(t.getBuffer(), "");
    assert.equal(t.backspace(), false);
  });

  it("resets without emitting", () => {
    const t = createTransliterator();
    t.add("c");
    t.reset();
    assert.equal(t.getBuffer(), "");
    assert.equal(t.commit(), "");
  });
});
