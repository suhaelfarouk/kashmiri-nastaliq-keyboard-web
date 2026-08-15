import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_GROUPS } from "../src/data/characters.js";
import { isCombiningMark, markPlacement } from "../src/data/marks.js";

const allItems = CHARACTER_GROUPS.flatMap((group) => group.items);

describe("extended character inventory", () => {
  it("has unique category identifiers", () => {
    const ids = CHARACTER_GROUPS.map((group) => group.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("contains the Kashmiri-specific letters and marks", () => {
    const values = new Set(allItems.map((item) => item.value));
    for (const required of ["ؠ", "ٲ", "ۄ", "ٕ", "ٖ", "ٟ", "ٚ", "ٗ", "ْ"]) {
      assert.ok(values.has(required), `missing ${required}`);
    }
  });

  it("shows combining marks bare, with no carrier letter", () => {
    const marks = allItems.filter((item) => item.isMark);
    assert.ok(marks.length > 0);
    for (const item of marks) {
      assert.equal(item.preview, item.value, `${item.name} should preview bare`);
      assert.equal([...item.value].length, 1, `${item.name} should be one code point`);
      assert.ok(isCombiningMark(item.value), `${item.name} should be a combining mark`);
    }
  });

  it("places below-baseline marks so they can be nudged into view", () => {
    assert.equal(markPlacement("ٕ"), "mark-below");
    assert.equal(markPlacement("ٖ"), "mark-below");
    assert.equal(markPlacement("ٗ"), "mark");
    assert.equal(markPlacement("ب"), null);
  });

  it("avoids Unicode forms discouraged for Kashmiri input", () => {
    const discouraged = new Set(["ٳ", "ێ", "ۆ", "ځ", "ݬ", "ࢡ"]);
    for (const { value } of allItems) {
      assert.equal(
        [...value].some((character) => discouraged.has(character)),
        false,
        `discouraged character in ${value}`
      );
    }
  });
});

