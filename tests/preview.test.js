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

const { createPreview } = await import("../src/ui/preview.js");

/** Minimal editor stand-in: the preview only needs these three reads. */
function fakeEditor(markdown, html, text) {
  return {
    getMarkdown: () => markdown,
    getHTML: () => html,
    get text() {
      return text;
    },
  };
}

describe("preview panel", () => {
  let card;
  let body;
  let toggleButton;
  let modesEl;
  let countEl;
  let preview;

  before(() => {
    card = document.createElement("section");
    body = document.createElement("div");
    toggleButton = document.createElement("button");
    countEl = document.createElement("span");

    modesEl = document.createElement("div");
    for (const mode of ["rendered", "markdown"]) {
      const button = document.createElement("button");
      button.dataset.preview = mode;
      modesEl.appendChild(button);
    }

    document.body.append(card, body, toggleButton, modesEl, countEl);

    preview = createPreview({
      card,
      body,
      toggleButton,
      modesEl,
      countEl,
      editor: fakeEditor("# سلام\n\nمتن", "<h1>سلام</h1><p>متن</p>", "سلام متن"),
    });
    preview.init();
  });

  after(() => {
    for (const el of [card, body, toggleButton, modesEl, countEl]) el.remove();
  });

  it("starts closed and hides the card", () => {
    assert.equal(preview.isOpen, false);
    assert.equal(card.hidden, true);
    assert.equal(body.childNodes.length, 0);
    assert.equal(toggleButton.getAttribute("aria-expanded"), "false");
  });

  it("renders the full document when toggled open", () => {
    toggleButton.click();
    assert.equal(preview.isOpen, true);
    assert.equal(card.hidden, false);
    assert.equal(toggleButton.getAttribute("aria-expanded"), "true");

    const rendered = body.querySelector(".preview-rendered");
    assert.ok(rendered);
    assert.equal(rendered.querySelector("h1").textContent, "سلام");
    assert.equal(rendered.getAttribute("dir"), "rtl");
    assert.equal(rendered.getAttribute("lang"), "ks");
  });

  it("reports word and character counts", () => {
    assert.equal(countEl.textContent, "2 words · 8 characters");
  });

  it("switches to the raw Markdown view", () => {
    modesEl.querySelector('[data-preview="markdown"]').click();
    assert.equal(preview.mode, "markdown");

    const pre = body.querySelector("pre.preview-markdown");
    assert.ok(pre);
    assert.equal(pre.textContent, "# سلام\n\nمتن");
    assert.equal(pre.getAttribute("dir"), "ltr");
    assert.equal(
      modesEl.querySelector('[data-preview="markdown"]').getAttribute("aria-pressed"),
      "true"
    );
  });

  it("clears the body when closed again", () => {
    toggleButton.click();
    assert.equal(preview.isOpen, false);
    assert.equal(card.hidden, true);
    assert.equal(body.childNodes.length, 0);
  });
});
