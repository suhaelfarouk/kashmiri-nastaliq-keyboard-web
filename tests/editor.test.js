import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "https://localhost/" });
const { document } = window;

Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  DocumentFragment: window.DocumentFragment,
  Node: window.Node,
  Element: window.Element,
  Text: window.Text,
  Document: window.Document,
  DOMParser: window.DOMParser,
  MutationObserver: window.MutationObserver,
  getSelection: () => window.getSelection(),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
});

try {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    get: () => window.navigator,
  });
} catch {
  /* already defined */
}

const { createEditor } = await import("../src/ui/editor.js");

describe("tiptap markdown editor", () => {
  let mount;
  let editor;

  before(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  after(() => {
    editor?.destroy();
    mount?.remove();
  });

  it("round-trips Kashmiri Markdown with formatting", () => {
    editor = createEditor({
      element: mount,
      initialMarkdown: "# کٲشُری\n\nیہ **کٲشُر** متن ہے، with `code` and a [link](https://example.com).",
    });

    const markdown = editor.getMarkdown();
    assert.match(markdown, /کٲشُری/);
    assert.match(markdown, /\*\*کٲشُر\*\*/);
    assert.match(markdown, /\[link\]\(https:\/\/example\.com\)/);

    editor.setMarkdown("## سلام\n\n- ایک\n- دو");
    assert.match(editor.getMarkdown(), /سلام/);
    assert.match(editor.getMarkdown(), /ایک/);
  });

  it("inserts Unicode text and deletes by code point", () => {
    editor?.destroy();
    editor = createEditor({ element: mount, initialMarkdown: "" });
    editor.insertText("ک");
    editor.insertText("َ");
    assert.equal(editor.text.replace(/\n/g, ""), "کَ");
    editor.backspace();
    assert.equal(editor.text.replace(/\n/g, ""), "ک");
    editor.backspace();
    assert.equal(editor.text.replace(/\n/g, ""), "");
  });

  it("preserves combining marks and joiners in Markdown", () => {
    editor?.destroy();
    const source = "بْ\u200Cؠ\u200Dٲ";
    editor = createEditor({ element: mount, initialMarkdown: source });
    assert.match(editor.getMarkdown(), /بْ/);
    assert.match(editor.getMarkdown(), /ؠ/);
    assert.match(editor.getMarkdown(), /ٲ/);
  });
});
