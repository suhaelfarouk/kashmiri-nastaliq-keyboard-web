import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTOSAVE_VERSION,
  createAutosave,
  createAutosavePayload,
  parseAutosave,
  serializeAutosave,
} from "../src/ui/autosave.js";
import { normalizeDocxFileName } from "../src/ui/file-io.js";

describe("autosave", () => {
  it("round-trips a versioned HTML payload", () => {
    const payload = createAutosavePayload({
      html: "<h1>کٲشُری</h1><p><strong>bold</strong></p>",
      fontPresetId: "gulmarg-nastaliq",
      fontSize: 32,
      fileName: "note.docx",
      updatedAt: 123,
    });
    const restored = parseAutosave(serializeAutosave(payload));
    assert.deepEqual(restored, {
      version: AUTOSAVE_VERSION,
      html: "<h1>کٲشُری</h1><p><strong>bold</strong></p>",
      fontPresetId: "gulmarg-nastaliq",
      fontSize: 32,
      fileName: "note.docx",
      updatedAt: 123,
    });
    assert.equal(AUTOSAVE_VERSION, 2);
  });

  it("migrates a v1 Markdown draft to escaped HTML", () => {
    const restored = parseAutosave(
      JSON.stringify({
        version: 1,
        markdown: "سلام\n\n**bold**",
        fontPresetId: "noto-nastaliq",
        fontSize: 28,
        fileName: "old.md",
        updatedAt: 1,
      }),
    );
    assert.equal(restored.version, 2);
    assert.match(restored.html, /سلام/);
    assert.match(restored.html, /\*\*bold\*\*/);
    assert.equal(restored.fileName, "old.docx");
  });

  it("rejects invalid or mismatched versions", () => {
    assert.equal(parseAutosave(null), null);
    assert.equal(parseAutosave("{"), null);
    assert.equal(parseAutosave(JSON.stringify({ version: 999, html: "x" })), null);
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
        html: "<p>سلام</p>",
        fontPresetId: "scheherazade",
        fontSize: 24,
        fileName: "a.docx",
      }),
      true,
    );
    assert.equal(autosave.load().html, "<p>سلام</p>");
    assert.equal(autosave.load().fontPresetId, "scheherazade");
    assert.equal(autosave.load().fontSize, 24);
    autosave.clear();
    assert.equal(autosave.load(), null);
  });
});

describe("file naming", () => {
  it("normalizes Word filenames", () => {
    assert.equal(normalizeDocxFileName("story"), "story.docx");
    assert.equal(normalizeDocxFileName("story.DOCX"), "story.DOCX");
    assert.equal(normalizeDocxFileName("note.docx"), "note.docx");
    assert.equal(normalizeDocxFileName("note.md"), "note.docx");
    assert.equal(normalizeDocxFileName("note.doc"), "note.docx");
    assert.equal(normalizeDocxFileName("  "), "document.docx");
  });
});
