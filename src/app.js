import { SMART_EXAMPLES, VOWEL_HELPERS } from "./data/transliteration.js";
import {
  DEFAULT_FONT_PRESET_ID,
  DEFAULT_FONT_SIZE,
  FONT_PRESETS,
  FONT_SIZES,
  getFontPreset,
  normalizeFontSize,
} from "./data/font-presets.js";
import { createTransliterator } from "./core/transliterator.js";
import { createEditor } from "./ui/editor.js";
import { createKeyboard } from "./ui/keyboard.js";
import { createCharacterPalette } from "./ui/character-palette.js";
import { createFormatToolbar } from "./ui/format-toolbar.js";
import { createPreview } from "./ui/preview.js";
import { createAutosave } from "./ui/autosave.js";
import { bindOpenMarkdown, downloadMarkdown } from "./ui/file-io.js";

/**
 * Compose data, core, and UI controllers into the running app.
 */
export function initApp(root = document) {
  const editorEl = root.querySelector("#editor");
  const statusEl = root.querySelector("#status");
  const layerStatusEl = root.querySelector("#layerStatus");
  const keyboardEl = root.querySelector("#keyboard");
  const physicalToggle = root.querySelector("#physicalToggle");
  const dualLayerToggle = root.querySelector("#dualLayerToggle");
  const modeSelect = root.querySelector("#modeSelect");
  const fontSelect = root.querySelector("#fontSelect");
  const fontSizeSelect = root.querySelector("#fontSizeSelect");
  const layerSelectEl = root.querySelector("#layerSelect");
  const formatToolbarEl = root.querySelector("#formatToolbar");
  const examplesEl = root.querySelector("#smartExamples");
  const vowelsEl = root.querySelector("#vowelHelpers");
  const characterPaletteEl = root.querySelector("#characterPalette");
  const fileNameEl = root.querySelector("#fileName");

  const transliterator = createTransliterator();
  const autosave = createAutosave();
  const saved = autosave.load();

  let fileName = saved?.fileName || "document.md";
  let fontPresetId = saved?.fontPresetId || DEFAULT_FONT_PRESET_ID;
  let fontSize = normalizeFontSize(saved?.fontSize ?? DEFAULT_FONT_SIZE);

  // Created after the editor so callbacks can close over them.
  let keyboard;
  let formatToolbar;
  let preview;

  const editor = createEditor({
    element: editorEl,
    statusEl,
    getModeLabel: () => (modeSelect.value === "phonetic" ? "Phonetic" : "Direct"),
    initialMarkdown: saved?.markdown ?? "",
    handleKeyDown: (event) => keyboard?.handlePhysicalKeydown(event),
    onUpdate: () => {
      persist();
      formatToolbar?.sync();
      preview?.render();
    },
    onSelectionUpdate: () => {
      formatToolbar?.sync();
    },
  });

  keyboard = createKeyboard({
    root: keyboardEl,
    layerStatusEl,
    layerSelectEl,
    transliterator,
    editor,
    getMode: () => modeSelect.value,
    isPhysicalEnabled: () => physicalToggle.checked,
  });

  const characterPalette = createCharacterPalette({
    root: characterPaletteEl,
    editor,
    beforeInsert: () => keyboard.flushTranslit(),
  });

  formatToolbar = createFormatToolbar({
    root: formatToolbarEl,
    getEditor: () => editor.tiptap,
  });

  preview = createPreview({
    card: root.querySelector("#previewCard"),
    body: root.querySelector("#previewBody"),
    toggleButton: root.querySelector("#previewBtn"),
    modesEl: root.querySelector("#previewModes"),
    countEl: root.querySelector("#previewCount"),
    editor,
  });

  function setFileName(name) {
    fileName = name || "document.md";
    if (fileNameEl) fileNameEl.textContent = fileName;
  }

  function applyTypography() {
    const preset = getFontPreset(fontPresetId);
    fontPresetId = preset.id;
    if (fontSelect) fontSelect.value = preset.id;
    if (fontSizeSelect) fontSizeSelect.value = String(fontSize);
    editor.setTypography({
      cssFamily: preset.cssFamily,
      lineHeight: preset.lineHeight,
      fontSize,
    });
    persist();
  }

  function persist() {
    autosave.schedule({
      markdown: editor.getMarkdown(),
      fontPresetId,
      fontSize,
      fileName,
    });
  }

  function renderFontOptions() {
    if (fontSelect) {
      fontSelect.replaceChildren(
        ...FONT_PRESETS.map((preset) => {
          const option = document.createElement("option");
          option.value = preset.id;
          option.textContent = preset.label;
          return option;
        })
      );
    }
    if (fontSizeSelect) {
      fontSizeSelect.replaceChildren(
        ...FONT_SIZES.map((size) => {
          const option = document.createElement("option");
          option.value = String(size);
          option.textContent = `${size} px`;
          return option;
        })
      );
    }
  }

  function renderExamples() {
    if (examplesEl) {
      examplesEl.replaceChildren(
        ...SMART_EXAMPLES.map(({ latin, unicode }) => {
          const item = document.createElement("div");
          item.innerHTML = `<kbd></kbd> → <span class="nastaliq"></span>`;
          item.querySelector("kbd").textContent = latin;
          item.querySelector(".nastaliq").textContent = unicode;
          return item;
        })
      );
    }
    if (vowelsEl) {
      vowelsEl.replaceChildren(
        ...VOWEL_HELPERS.map(({ latin, unicode, note }) => {
          const item = document.createElement("div");
          const noteHtml = note ? ` <span class="muted">${note}</span>` : "";
          item.innerHTML = `<kbd></kbd> → <span class="nastaliq"></span>${noteHtml}`;
          item.querySelector("kbd").textContent = latin;
          item.querySelector(".nastaliq").textContent = unicode;
          return item;
        })
      );
    }
  }

  // Toolbar actions
  root.querySelector("#clearBtn")?.addEventListener("click", () => {
    transliterator.reset();
    editor.clear();
    persist();
  });

  root.querySelector("#copyBtn")?.addEventListener("click", () => editor.copy());

  root.querySelector("#downloadBtn")?.addEventListener("click", () => {
    keyboard.flushTranslit();
    const savedName = downloadMarkdown(editor.getMarkdown(), fileName);
    setFileName(savedName);
    persist();
    editor.updateStatus("Downloaded");
    setTimeout(() => editor.updateStatus(), 1200);
  });

  bindOpenMarkdown({
    button: root.querySelector("#openBtn"),
    input: root.querySelector("#openFileInput"),
    onOpen: ({ markdown, fileName: openedName }) => {
      keyboard.flushTranslit();
      transliterator.reset();
      editor.setMarkdown(markdown);
      setFileName(openedName);
      persist();
      editor.focus();
      editor.updateStatus("Opened");
      setTimeout(() => editor.updateStatus(), 1200);
    },
  });

  root.querySelector("#backspaceBtn")?.addEventListener("click", () => {
    if (!transliterator.backspace()) editor.backspace();
    else editor.updateStatus();
  });

  root.querySelector("#spaceBtn")?.addEventListener("click", () => {
    keyboard.flushTranslit();
    transliterator.wordBoundary();
    editor.insertText(" ");
  });

  dualLayerToggle?.addEventListener("change", () => {
    keyboard.setDualLayer(dualLayerToggle.checked);
  });

  modeSelect?.addEventListener("change", () => {
    keyboard.flushTranslit();
    editor.updateStatus();
  });

  fontSelect?.addEventListener("change", () => {
    fontPresetId = fontSelect.value;
    applyTypography();
  });

  fontSizeSelect?.addEventListener("change", () => {
    fontSize = normalizeFontSize(fontSizeSelect.value);
    applyTypography();
  });

  // Reset phonetic buffer when the user types natively into the surface.
  editor.dom.addEventListener("input", () => {
    transliterator.reset();
    editor.updateStatus();
  });

  window.addEventListener("keyup", (e) => keyboard.handlePhysicalKeyup(e));
  window.addEventListener("blur", () => keyboard.resetModifiers());
  window.addEventListener("beforeunload", () => {
    autosave.flush({
      markdown: editor.getMarkdown(),
      fontPresetId,
      fontSize,
      fileName,
    });
  });

  renderFontOptions();
  setFileName(fileName);
  applyTypography();

  keyboard.init();
  characterPalette.init();
  formatToolbar.init();
  preview.init();
  if (dualLayerToggle?.checked) keyboard.setDualLayer(true);
  renderExamples();
  editor.updateStatus();
  editor.focus();
}
