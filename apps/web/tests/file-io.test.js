import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTOSAVE_VERSION,
  createAutosave,
  createAutosavePayload,
  parseAutosave,
  serializeAutosave,
} from "../src/ui/autosave.js";
import { normalizeMarkdownFileName } from "../src/ui/file-io.js";

describe("autosave", () => {
  it("round-trips a versioned payload", () => {
    const payload = createAutosavePayload({
      markdown: "# کٲشُری\n\n**bold**",
      fontPresetId: "gulmarg-nastaliq",
      fontSize: 32,
      fileName: "note.md",
      updatedAt: 123,
    });
    const restored = parseAutosave(serializeAutosave(payload));
    assert.deepEqual(restored, {
      version: AUTOSAVE_VERSION,
      markdown: "# کٲشُری\n\n**bold**",
      fontPresetId: "gulmarg-nastaliq",
      fontSize: 32,
      fileName: "note.md",
      updatedAt: 123,
    });
  });

  it("rejects invalid or mismatched versions", () => {
    assert.equal(parseAutosave(null), null);
    assert.equal(parseAutosave("{"), null);
    assert.equal(parseAutosave(JSON.stringify({ version: 999, markdown: "x" })), null);
  });

  it("persists through a storage adapter", () => {
    const store = new Map();
    const storage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    };
    const autosave = createAutosave({ storage, debounceMs: 0 });
    assert.equal(autosave.load(), null);
    assert.equal(
      autosave.save({
        markdown: "سلام",
        fontPresetId: "scheherazade",
        fontSize: 24,
        fileName: "a.md",
      }),
      true
    );
    assert.equal(autosave.load().markdown, "سلام");
    assert.equal(autosave.load().fontPresetId, "scheherazade");
    assert.equal(autosave.load().fontSize, 24);
    autosave.clear();
    assert.equal(autosave.load(), null);
  });
});

describe("file naming", () => {
  it("normalizes Markdown filenames", () => {
    assert.equal(normalizeMarkdownFileName("story"), "story.md");
    assert.equal(normalizeMarkdownFileName("story.MD"), "story.MD");
    assert.equal(normalizeMarkdownFileName("note.md"), "note.md");
    assert.equal(normalizeMarkdownFileName("  "), "document.md");
  });
});
