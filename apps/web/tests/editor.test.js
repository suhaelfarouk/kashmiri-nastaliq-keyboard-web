import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
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

describe("tiptap wysiwyg editor", () => {
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

  it("round-trips Kashmiri HTML with formatting", () => {
    editor = createEditor({
      element: mount,
      initialHTML:
        "<h1>کٲشُری</h1><p>یہ <strong>کٲشُر</strong> متن ہے، with <code>code</code> and a <a href=\"https://example.com\">link</a>.</p>",
    });

    const html = editor.getHTML();
    assert.match(html, /کٲشُری/);
    assert.match(html, /<strong>کٲشُر<\/strong>/);
    assert.match(html, /href="https:\/\/example\.com"/);

    editor.setHTML("<h2>سلام</h2><ul><li>ایک</li><li>دو</li></ul>");
    assert.match(editor.getHTML(), /سلام/);
    assert.match(editor.getHTML(), /ایک/);
    assert.equal(editor.getJSON().type, "doc");
  });

  it("inserts Unicode text and deletes by code point", () => {
    editor?.destroy();
    editor = createEditor({ element: mount, initialHTML: "" });
    editor.insertText("ک");
    editor.insertText("َ");
    assert.equal(editor.text.replace(/\n/g, ""), "کَ");
    editor.backspace();
    assert.equal(editor.text.replace(/\n/g, ""), "ک");
    editor.backspace();
    assert.equal(editor.text.replace(/\n/g, ""), "");
  });

  it("preserves combining marks and joiners", () => {
    editor?.destroy();
    const source = "بْ\u200Cؠ\u200Dٲ";
    editor = createEditor({ element: mount, initialHTML: `<p>${source}</p>` });
    assert.match(editor.getHTML(), /بْ/);
    assert.match(editor.getHTML(), /ؠ/);
    assert.match(editor.getHTML(), /ٲ/);
  });
});
