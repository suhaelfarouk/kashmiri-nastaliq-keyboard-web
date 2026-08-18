import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { KEY_CODES, KEYBOARD_ROWS, LAYERS } from "../src/data/keyboard.js";
import { createKeyboard } from "../src/ui/keyboard.js";

/**
 * `createKeyboard` builds DOM nodes with bare `document.createElement`
 * calls, so a global `document` must exist before `init()` runs.
 */
function fakeTransliterator({
  backspaceResult = false,
  commitText = "",
  handleKeyResult = () => ({ handled: false, text: "" }),
} = {}) {
  const calls = { backspace: 0, wordBoundary: 0, commit: 0, reset: 0, handleKey: [] };
  return {
    calls,
    backspace() {
      calls.backspace++;
      return backspaceResult;
    },
    wordBoundary() {
      calls.wordBoundary++;
    },
    commit() {
      calls.commit++;
      return commitText;
    },
    reset() {
      calls.reset++;
    },
    handleKey(key) {
      calls.handleKey.push(key);
      return handleKeyResult(key);
    },
  };
}

function fakeEditor() {
  const inserted = [];
  const calls = { backspace: 0, updateStatus: 0 };
  return {
    inserted,
    calls,
    insertText(text) {
      inserted.push(text);
    },
    backspace() {
      calls.backspace++;
    },
    updateStatus() {
      calls.updateStatus++;
    },
  };
}

function createKeyEvent({
  code,
  key = "",
  shiftKey = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
}) {
  return {
    code,
    key,
    shiftKey,
    altKey,
    ctrlKey,
    metaKey,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function setup({ mode = "direct", physicalEnabled = true, transliterator, editor } = {}) {
  const window = new Window({ url: "https://localhost/" });
  globalThis.document = window.document;

  const root = window.document.createElement("div");
  const layerStatusEl = window.document.createElement("span");
  const layerSelectEl = window.document.createElement("div");
  for (const layer of Object.values(LAYERS)) {
    const button = window.document.createElement("button");
    button.dataset.layer = layer;
    layerSelectEl.appendChild(button);
  }
  window.document.body.append(root, layerStatusEl, layerSelectEl);

  const state = { mode, physicalEnabled };
  const t = transliterator ?? fakeTransliterator();
  const e = editor ?? fakeEditor();

  const keyboard = createKeyboard({
    root,
    layerStatusEl,
    layerSelectEl,
    transliterator: t,
    editor: e,
    getMode: () => state.mode,
    isPhysicalEnabled: () => state.physicalEnabled,
  });
  keyboard.init();

  return {
    window,
    root,
    layerStatusEl,
    layerSelectEl,
    keyboard,
    transliterator: t,
    editor: e,
    state,
  };
}

function click(root, code) {
  root.querySelector(`[data-code="${code}"]`).click();
}

describe("keyboard controller", () => {
  it("renders every row and gives character keys four layer faces", () => {
    const { root } = setup();
    const buttons = root.querySelectorAll("button[data-code]");
    assert.equal(buttons.length, KEYBOARD_ROWS.flat().length);

    const keyA = root.querySelector('[data-code="KeyA"]');
    assert.equal(keyA.querySelector(".face-base").textContent, "ا");
    assert.equal(keyA.querySelector(".face-shift").textContent, "آ");
    assert.equal(keyA.querySelector(".face-alt").textContent, "اٟ");
    assert.equal(keyA.querySelector(".face-alt-shift").textContent, "أ");
  });

  it("marks a key same-face when shift has no distinct mapping", () => {
    const { root } = setup();
    // KeyQ has no explicit shift, so it falls back to base.
    assert.ok(root.querySelector('[data-code="KeyQ"]').classList.contains("same-face"));
    assert.ok(!root.querySelector('[data-code="KeyA"]').classList.contains("same-face"));
  });

  it("clicking a character key flushes the buffer and emits the base-layer character", () => {
    const transliterator = fakeTransliterator({ commitText: "بُز" });
    const editor = fakeEditor();
    const { root } = setup({ transliterator, editor });

    click(root, "KeyA");

    assert.deepEqual(editor.inserted, ["بُز", "ا"]);
    assert.equal(transliterator.calls.commit, 1);
  });

  it("emits a word boundary when a punctuation or space character is typed", () => {
    const editor = fakeEditor();
    const transliterator = fakeTransliterator();
    const { root } = setup({ editor, transliterator });

    click(root, KEY_CODES.SPACE);

    assert.deepEqual(editor.inserted, [" "]);
    assert.equal(transliterator.calls.wordBoundary, 1);
  });

  it("selects a layer from the layer buttons and toggles it off on a second click", () => {
    const { root, layerSelectEl, keyboard } = setup();

    layerSelectEl.querySelector('[data-layer="shift"]').click();
    assert.equal(keyboard.activeLayer, LAYERS.SHIFT);
    assert.equal(root.classList.contains("shift-active"), true);
    assert.equal(
      layerSelectEl.querySelector('[data-layer="shift"]').getAttribute("aria-pressed"),
      "true",
    );

    layerSelectEl.querySelector('[data-layer="shift"]').click();
    assert.equal(keyboard.activeLayer, LAYERS.BASE);
    assert.equal(root.classList.contains("shift-active"), false);
  });

  it("treats the on-screen Shift key as a one-shot layer that releases after one character", () => {
    const editor = fakeEditor();
    const { root, keyboard } = setup({ editor });

    click(root, KEY_CODES.SHIFT);
    assert.equal(keyboard.activeLayer, LAYERS.SHIFT);

    click(root, "KeyA");
    assert.deepEqual(editor.inserted, ["آ"]);
    assert.equal(keyboard.activeLayer, LAYERS.BASE);
  });

  it("deletes from the phonetic buffer before touching the document", () => {
    const editor = fakeEditor();
    const transliterator = fakeTransliterator({ backspaceResult: true });
    const { root } = setup({ editor, transliterator });

    click(root, KEY_CODES.BACKSPACE);

    assert.equal(transliterator.calls.backspace, 1);
    assert.equal(editor.calls.updateStatus, 1);
    assert.equal(editor.calls.backspace, 0);
  });

  it("falls back to editor.backspace() once the phonetic buffer is empty", () => {
    const editor = fakeEditor();
    const transliterator = fakeTransliterator({ backspaceResult: false });
    const { root } = setup({ editor, transliterator });

    click(root, KEY_CODES.BACKSPACE);

    assert.equal(transliterator.calls.backspace, 1);
    assert.equal(editor.calls.backspace, 1);
  });

  it("tracks a held physical Shift key even while the keyboard mapping toggle is off", () => {
    const { keyboard } = setup({ physicalEnabled: false });

    keyboard.handlePhysicalKeydown(createKeyEvent({ code: "ShiftLeft" }));
    assert.equal(keyboard.activeLayer, LAYERS.SHIFT);

    keyboard.handlePhysicalKeyup(createKeyEvent({ code: "ShiftLeft" }));
    assert.equal(keyboard.activeLayer, LAYERS.BASE);
  });

  it("ignores physical character keys entirely when the keyboard mapping toggle is off", () => {
    const editor = fakeEditor();
    const { keyboard } = setup({ editor, physicalEnabled: false });

    const event = createKeyEvent({ code: "KeyA", key: "a" });
    keyboard.handlePhysicalKeydown(event);

    assert.deepEqual(editor.inserted, []);
    assert.equal(event.defaultPrevented, false);
  });

  it("inserts the base-layer character for a physical key press in direct mode", () => {
    const editor = fakeEditor();
    const { keyboard } = setup({ editor, mode: "direct" });

    const event = createKeyEvent({ code: "KeyA", key: "a" });
    keyboard.handlePhysicalKeydown(event);

    assert.deepEqual(editor.inserted, ["ا"]);
    assert.equal(event.defaultPrevented, true);
  });

  it("bypasses phonetic buffering when a physical modifier is held, even in phonetic mode", () => {
    const editor = fakeEditor();
    const transliterator = fakeTransliterator();
    const { keyboard } = setup({ editor, transliterator, mode: "phonetic" });

    const event = createKeyEvent({ code: "KeyA", key: "a", shiftKey: true });
    keyboard.handlePhysicalKeydown(event);

    assert.deepEqual(editor.inserted, ["آ"]);
    assert.equal(transliterator.calls.handleKey.length, 0);
    assert.equal(event.defaultPrevented, true);
  });

  it("routes plain letters through the phonetic engine in phonetic mode", () => {
    const editor = fakeEditor();
    const transliterator = fakeTransliterator({
      handleKeyResult: (key) => ({ handled: true, text: key === "k" ? "" : "ک" }),
    });
    const { keyboard } = setup({ editor, transliterator, mode: "phonetic" });

    const event = createKeyEvent({ code: "KeyK", key: "k" });
    keyboard.handlePhysicalKeydown(event);

    assert.deepEqual(transliterator.calls.handleKey, ["k"]);
    assert.equal(event.defaultPrevented, true);
  });

  it("swallows Alt+key when the alt-shift layer has no mapping, so no stray character leaks through", () => {
    const editor = fakeEditor();
    const { keyboard } = setup({ editor });

    // KeyR has no altShift mapping.
    const event = createKeyEvent({ code: "KeyR", key: "r", shiftKey: true, altKey: true });
    keyboard.handlePhysicalKeydown(event);

    assert.deepEqual(editor.inserted, []);
    assert.equal(event.defaultPrevented, true);
  });

  it("toggles the dual-layer class on the keyboard root", () => {
    const { root, keyboard } = setup();

    keyboard.setDualLayer(true);
    assert.equal(root.classList.contains("dual-layer"), true);

    keyboard.setDualLayer(false);
    assert.equal(root.classList.contains("dual-layer"), false);
  });

  it("resets held modifiers back to the sticky layer", () => {
    const { keyboard } = setup();

    keyboard.handlePhysicalKeydown(createKeyEvent({ code: "AltLeft" }));
    assert.equal(keyboard.activeLayer, LAYERS.ALT);

    keyboard.resetModifiers();
    assert.equal(keyboard.activeLayer, LAYERS.BASE);
  });
});
