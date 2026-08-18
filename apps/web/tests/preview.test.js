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

const { createPreview } = await import("../src/ui/preview.js");

/** Minimal editor stand-in: the preview only needs these three reads. */
function fakeEditor(html, text) {
  return {
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
  let countEl;
  let preview;

  before(() => {
    card = document.createElement("section");
    body = document.createElement("div");
    toggleButton = document.createElement("button");
    countEl = document.createElement("span");

    document.body.append(card, body, toggleButton, countEl);

    preview = createPreview({
      card,
      body,
      toggleButton,
      countEl,
      editor: fakeEditor(
        "<h1>\u0633\u0644\u0627\u0645</h1><p>\u0645\u062a\u0646</p>",
        "\u0633\u0644\u0627\u0645 \u0645\u062a\u0646",
      ),
    });
    preview.init();
  });

  after(() => {
    for (const el of [card, body, toggleButton, countEl]) el.remove();
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
    assert.equal(rendered.querySelector("h1").textContent, "\u0633\u0644\u0627\u0645");
    assert.equal(rendered.getAttribute("dir"), "rtl");
    assert.equal(rendered.getAttribute("lang"), "ks");
  });

  it("reports word and character counts", () => {
    assert.equal(countEl.textContent, "2 words \u00b7 8 characters");
  });

  it("clears the body when closed again", () => {
    toggleButton.click();
    assert.equal(preview.isOpen, false);
    assert.equal(card.hidden, true);
    assert.equal(body.childNodes.length, 0);
  });
});
